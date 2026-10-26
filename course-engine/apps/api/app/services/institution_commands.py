from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import (
    CommandReceipt,
    Institution,
    OutboxEvent,
    TenantCapability,
    User,
    WorkspaceGrant,
)


@dataclass(frozen=True)
class CommandPolicy:
    capability: str
    roles: frozenset[str]
    required_fields: frozenset[str]


class CommandPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RegistrationPayload(CommandPayload):
    student_user_id: UUID
    course_section_id: str = Field(min_length=1, max_length=120)


class GradeEntry(CommandPayload):
    student_user_id: UUID
    grade: str = Field(min_length=1, max_length=32)


class FinalGradesPayload(CommandPayload):
    course_section_id: str = Field(min_length=1, max_length=120)
    grades: list[GradeEntry] = Field(min_length=1, max_length=5000)


class HoldReleasePayload(CommandPayload):
    student_user_id: UUID
    hold_id: str = Field(min_length=1, max_length=120)


COMMAND_POLICIES = {
    "registration.add": CommandPolicy(
        "registration.write", frozenset({"student", "registrar", "institution", "operations"}),
        frozenset({"student_user_id", "course_section_id"}),
    ),
    "registration.drop": CommandPolicy(
        "registration.write", frozenset({"student", "registrar", "institution", "operations"}),
        frozenset({"student_user_id", "course_section_id"}),
    ),
    "grades.submit_final": CommandPolicy(
        "grades.write", frozenset({"faculty", "registrar"}),
        frozenset({"course_section_id", "grades"}),
    ),
    "records.hold_release": CommandPolicy(
        "records.hold.write", frozenset({"registrar"}),
        frozenset({"student_user_id", "hold_id"}),
    ),
}

COMMAND_PAYLOADS: dict[str, type[CommandPayload]] = {
    "registration.add": RegistrationPayload,
    "registration.drop": RegistrationPayload,
    "grades.submit_final": FinalGradesPayload,
    "records.hold_release": HoldReleasePayload,
}


def _is_active(grant: WorkspaceGrant, now: datetime) -> bool:
    if grant.valid_until is None:
        return True
    valid_until = grant.valid_until
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=UTC)
    return valid_until > now


def _payload_hash(command_type: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"command_type": command_type, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _authorized_grant(
    db: Session,
    institution_id: UUID,
    user: User,
    policy: CommandPolicy,
) -> WorkspaceGrant:
    grants = db.scalars(
        select(WorkspaceGrant).where(
            WorkspaceGrant.institution_id == institution_id,
            WorkspaceGrant.user_id == user.id,
            WorkspaceGrant.role.in_(policy.roles),
        )
    ).all()
    now = datetime.now(UTC)
    grant = next((candidate for candidate in grants if _is_active(candidate, now)), None)
    if not grant:
        raise HTTPException(403, "Active institutional grant required")
    return grant


def _enabled_capability(
    db: Session,
    institution_id: UUID,
    capability_name: str,
) -> TenantCapability:
    capability = db.scalar(
        select(TenantCapability).where(
            TenantCapability.institution_id == institution_id,
            TenantCapability.capability == capability_name,
        )
    )
    if not capability or not capability.enabled or not capability.approval_reference:
        raise HTTPException(423, f"Capability {capability_name} is not approved and enabled")
    if capability.kill_switch_active:
        raise HTTPException(423, f"Capability {capability_name} is paused by its kill switch")
    return capability


def _validate_payload(
    command_type: str,
    payload: dict[str, Any],
    policy: CommandPolicy,
    user: User,
    grant: WorkspaceGrant,
) -> dict[str, Any]:
    try:
        validated = COMMAND_PAYLOADS[command_type].model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            422,
            detail={"message": "Invalid command payload", "errors": exc.errors()},
        ) from exc
    normalized = validated.model_dump(mode="json")
    if command_type.startswith("registration.") and grant.role == "student":
        if normalized["student_user_id"] != str(user.id):
            raise HTTPException(403, "Students may only submit registration commands for themselves")
    return normalized


def submit_institution_command(
    db: Session,
    institution_id: UUID,
    user: User,
    command_type: str,
    payload: dict[str, Any],
    idempotency_key: str,
) -> tuple[CommandReceipt, bool]:
    if not db.get(Institution, institution_id):
        raise HTTPException(404, "Institution not found")

    policy = COMMAND_POLICIES[command_type]
    grant = _authorized_grant(db, institution_id, user, policy)
    _enabled_capability(db, institution_id, policy.capability)
    payload = _validate_payload(command_type, payload, policy, user, grant)

    digest = _payload_hash(command_type, payload)
    existing = db.scalar(
        select(CommandReceipt).where(
            CommandReceipt.institution_id == institution_id,
            CommandReceipt.idempotency_key == idempotency_key,
        )
    )
    if existing:
        if existing.payload_hash != digest or existing.actor_user_id != user.id:
            raise HTTPException(409, "Idempotency key was already used for a different command")
        return existing, True

    receipt = CommandReceipt(
        institution_id=institution_id,
        actor_user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        payload_hash=digest,
        payload=payload,
        status="accepted",
    )
    try:
        db.add(receipt)
        db.flush()
        db.add(
            OutboxEvent(
                institution_id=institution_id,
                receipt_id=receipt.id,
                event_type=f"institution.command.{command_type}",
                payload={
                    "receipt_id": str(receipt.id),
                    "command_type": command_type,
                    "payload": payload,
                },
            )
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        collided = db.scalar(
            select(CommandReceipt).where(
                CommandReceipt.institution_id == institution_id,
                CommandReceipt.idempotency_key == idempotency_key,
            )
        )
        if collided and collided.payload_hash == digest and collided.actor_user_id == user.id:
            return collided, True
        raise HTTPException(409, "Idempotency key was already used") from exc
    db.refresh(receipt)
    return receipt, False

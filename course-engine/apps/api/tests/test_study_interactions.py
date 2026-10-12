from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.entities import Concept, Course, ReviewStatus, StudyAsset, StudySession, User


def _database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_card_review_and_quiz_attempt_require_real_owned_assets():
    testing_session = _database()
    card_id = UUID("00000000-0000-0000-0000-000000000030")
    with testing_session() as session:
        owner = User(email="study-owner@example.com", password_hash="unused")
        outsider = User(email="study-outsider@example.com", password_hash="unused")
        session.add_all([owner, outsider])
        session.flush()
        course = Course(user_id=owner.id, title="Study interactions")
        outsider_course = Course(user_id=outsider.id, title="Other course")
        session.add_all([course, outsider_course])
        session.flush()
        outsider_concept = Concept(course_id=outsider_course.id, name="Private concept")
        cards = StudyAsset(
            course_id=course.id,
            asset_type="flashcards",
            title="Cards",
            content={"cards": [{"id": str(card_id), "front": "Prompt", "back": "Answer"}]},
        )
        rejected_cards = StudyAsset(
            course_id=course.id,
            asset_type="flashcards",
            title="Rejected cards",
            status=ReviewStatus.rejected,
            content={"cards": [{"id": str(card_id), "front": "Stale prompt", "back": "Stale answer"}]},
        )
        quiz = StudyAsset(
            course_id=course.id,
            asset_type="practice_quiz",
            title="Quiz",
            content={"sections": [
                {"heading": "One", "explanation": "Answer", "citation_ids": [str(UUID(int=10))]},
                {"heading": "Malformed", "explanation": "Skip", "citation_ids": [str(UUID(int=10))], "key_points": {"bad": True}},
            ]},
        )
        session.add_all([outsider_concept, cards, rejected_cards, quiz])
        session.commit()
        owner_id, outsider_id, course_id, cards_id, rejected_cards_id, quiz_id = (
            owner.id, outsider.id, course.id, cards.id, rejected_cards.id, quiz.id
        )
        outsider_concept_id = outsider_concept.id

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_id)}"}
        outsider_headers = {"Authorization": f"Bearer {create_access_token(outsider_id)}"}
        card_payload = {"course_id": str(course_id), "asset_id": str(cards_id), "concept_id": None, "correct": True, "confidence": 4}
        assert client.post(f"/api/v1/flashcards/{card_id}/review", json=card_payload, headers=outsider_headers).status_code == 404
        cross_course_payload = {**card_payload, "concept_id": str(outsider_concept_id)}
        assert client.post(
            f"/api/v1/flashcards/{card_id}/review",
            json=cross_course_payload,
            headers=owner_headers,
        ).status_code == 404
        assert client.post(f"/api/v1/flashcards/{card_id}/review", json=card_payload, headers=owner_headers).status_code == 200
        assert client.post(f"/api/v1/flashcards/{UUID(int=99)}/review", json=card_payload, headers=owner_headers).status_code == 404
        rejected_card_payload = {**card_payload, "asset_id": str(rejected_cards_id)}
        assert client.post(f"/api/v1/flashcards/{card_id}/review", json=rejected_card_payload, headers=owner_headers).status_code == 404

        quiz_payload = {"course_id": str(course_id), "answers": [{"question_index": 0, "correct": True}]}
        assert client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=quiz_payload, headers=outsider_headers).status_code == 404
        incomplete = {"course_id": str(course_id), "answers": []}
        assert client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=incomplete, headers=owner_headers).status_code == 400
        malformed = {"course_id": str(course_id), "answers": [{"question_index": 1, "correct": True}]}
        assert client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=malformed, headers=owner_headers).status_code == 400
        response = client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=quiz_payload, headers=owner_headers)
        assert response.status_code == 200
        assert response.json()["answer_count"] == 1
        with testing_session() as session:
            saved = session.scalar(select(StudySession).where(StudySession.id == UUID(response.json()["id"])))
            assert saved and saved.course_id == course_id and saved.study_asset_id == quiz_id
            assert saved.result == {
                "answers": [{"question_index": 0, "correct": True}],
                "correct_answers": 1,
                "question_count": 1,
            }
            assert session.scalar(select(func.count()).select_from(StudySession)) == 1
        progress = client.get(f"/api/v1/courses/{course_id}/progress", headers=owner_headers)
        assert progress.status_code == 200
        quiz_evidence = next(item for item in progress.json()["items"] if item["kind"] == "quiz")
        assert quiz_evidence == {
            "id": response.json()["id"],
            "kind": "quiz",
            "mastery_score": 1.0,
            "attempts": 1,
            "correct_attempts": 1,
            "next_review_at": None,
        }
        assert progress.json()["average_mastery"] == 1.0

        with testing_session() as session:
            session.add_all([
                StudySession(
                    user_id=owner_id,
                    course_id=course_id,
                    study_asset_id=quiz_id,
                    mode="quiz",
                    result={"answers": [], "correct_answers": 0, "question_count": 1},
                    ended_at=datetime.now(UTC),
                )
                for _ in range(55)
            ])
            session.commit()
        bounded_progress = client.get(f"/api/v1/courses/{course_id}/progress", headers=owner_headers)
        assert len([item for item in bounded_progress.json()["items"] if item["kind"] == "quiz"]) == 50

        with testing_session() as session:
            session.get(StudyAsset, quiz_id).status = ReviewStatus.rejected
            session.get(StudyAsset, cards_id).status = ReviewStatus.rejected
            session.commit()
        assert client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=quiz_payload, headers=owner_headers).status_code == 404
        assert client.post(f"/api/v1/flashcards/{card_id}/review", json=card_payload, headers=owner_headers).status_code == 404
    finally:
        app.dependency_overrides.clear()

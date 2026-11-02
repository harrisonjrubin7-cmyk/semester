import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { authenticate } from "../src/auth";

describe("JWT verification", () => {
  let keys: { publicKey: CryptoKey; privateKey: CryptoKey };
  const issuer = "https://test-issuer.example";
  const audience = "semester-api";
  const subject = "10000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    keys = (await generateKeyPair("RS256")) as unknown as typeof keys;
  });

  function app() {
    const api = express();
    api.get(
      "/protected",
      authenticate({ key: keys.publicKey, issuer, audience, algorithms: ["RS256"], maxTokenAge: "20m" }),
      (req, res) => { res.json(res.locals.auth); }
    );
    return api;
  }

  async function token(o: { issuer?: string; audience?: string; issuedAt?: number; expiresAt?: number; claims?: Record<string, unknown> } = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT(o.claims ?? {})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(subject)
      .setIssuer(o.issuer ?? issuer)
      .setAudience(o.audience ?? audience)
      .setIssuedAt(o.issuedAt ?? now)
      .setExpirationTime(o.expiresAt ?? now + 300)
      .sign(keys.privateKey);
  }
  const get = (jwt?: string) => {
    const r = request(app()).get("/protected");
    return jwt === undefined ? r : r.set("Authorization", `Bearer ${jwt}`);
  };

  it("accepts a valid token", async () => {
    const res = await get(await token());
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(subject);
  });
  it("rejects a missing token", async () => {
    expect((await get()).status).toBe(401);
  });
  it("rejects a token expired beyond clock tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect((await get(await token({ issuedAt: now - 600, expiresAt: now - 60 }))).status).toBe(401);
  });
  it("rejects a token older than maxTokenAge even if not expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect((await get(await token({ issuedAt: now - 25 * 60, expiresAt: now + 300 }))).status).toBe(401);
  });
  it("rejects the wrong issuer", async () => {
    expect((await get(await token({ issuer: "https://untrusted.example" }))).status).toBe(401);
  });
  it("rejects the wrong audience", async () => {
    expect((await get(await token({ audience: "another-api" }))).status).toBe(401);
  });
  it("rejects a token signed by another key", async () => {
    const other = await generateKeyPair("RS256");
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).setSubject(subject)
      .setIssuer(issuer).setAudience(audience).setIssuedAt(now).setExpirationTime(now + 300).sign(other.privateKey);
    expect((await get(jwt)).status).toBe(401);
  });
  it("rejects an unsigned (alg: none) token", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const jwt = `${b64({ alg: "none" })}.${b64({ sub: subject, iss: issuer, aud: audience, iat: now, exp: now + 300 })}.`;
    expect((await get(jwt)).status).toBe(401);
  });
  it("rejects a non-UUID subject", async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).setSubject("admin")
      .setIssuer(issuer).setAudience(audience).setIssuedAt(now).setExpirationTime(now + 300).sign(keys.privateKey);
    expect((await get(jwt)).status).toBe(401);
  });
  it("does not promote role claims to application authority", async () => {
    const res = await get(await token({ claims: { role: "admin", roles: ["super_admin"], user_metadata: { role: "registrar" } } }));
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("role");
    expect(res.body).not.toHaveProperty("roles");
    expect(res.body).not.toHaveProperty("user_metadata");
  });
});

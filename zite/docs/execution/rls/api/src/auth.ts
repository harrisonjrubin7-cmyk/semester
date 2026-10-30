import type { RequestHandler } from "express";
import { jwtVerify, type JWTVerifyGetKey, type KeyLike } from "jose";
import { databaseUuid } from "./schemas";

// CHANGED: the document used Parameters<typeof jwtVerify>[1], which resolves to jose's last overload
// (a key-resolver function only), so passing a public key in tests fails typecheck. Accept both forms.
type VerificationKey = KeyLike | Uint8Array | JWTVerifyGetKey;

export type AuthConfig = {
  key: VerificationKey;
  issuer: string;
  audience: string;
  algorithms: string[];
  maxTokenAge: string;
};

export function authenticate(config: AuthConfig): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.header("authorization") ?? "");
    if (!match) {
      res.status(401).json({ error: { code: "AUTH_REQUIRED" } });
      return;
    }
    try {
      const options = {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: config.algorithms,
        requiredClaims: ["sub", "iat", "exp"],
        maxTokenAge: config.maxTokenAge,
        clockTolerance: 5,
      };
      const { payload } = typeof config.key === "function"
        ? await jwtVerify(match[1], config.key, options)
        : await jwtVerify(match[1], config.key, options);
      const userId = databaseUuid.parse(payload.sub);
      res.locals.auth = { userId, tokenId: payload.jti ?? null };
      next();
    } catch {
      res.status(401).json({ error: { code: "INVALID_ACCESS_TOKEN" } });
    }
  };
}

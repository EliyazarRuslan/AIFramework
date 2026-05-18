// Entra ID (Azure AD) JWT verification middleware.
// Validates Bearer tokens against Goldbell single-tenant JWKS.
// Attaches req.user = { oid, email, name } on success.

const { upsertUser } = require("./repos/users.js");

let josePromise = null;
async function getJose() {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

const TENANT_ID = process.env.ENTRA_TENANT_ID;
const CLIENT_ID = process.env.ENTRA_CLIENT_ID;
const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";
// ID-token mode: audience is the app's clientId, issuer is v2 only (MSAL v2 default).

if (!AUTH_DISABLED && (!TENANT_ID || !CLIENT_ID)) {
  console.warn("[auth] ENTRA_TENANT_ID / ENTRA_CLIENT_ID missing. Auth will fail.");
}

const ISSUER_V2 = TENANT_ID ? `https://login.microsoftonline.com/${TENANT_ID}/v2.0` : null;

let jwksCache = null;
async function getJwks() {
  if (!TENANT_ID) throw new Error("ENTRA_TENANT_ID not configured.");
  if (!jwksCache) {
    const { createRemoteJWKSet } = await getJose();
    jwksCache = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`),
    );
  }
  return jwksCache;
}

async function requireAuth(req, res, next) {
  if (AUTH_DISABLED) {
    req.user = {
      oid: "dev-local-user",
      email: "dev@local",
      name: "Dev User",
    };
    return next();
  }

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Missing Bearer token." });
  }
  const token = match[1].trim();

  try {
    const { jwtVerify } = await getJose();
    const jwks = await getJwks();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: [ISSUER_V2].filter(Boolean),
      audience: CLIENT_ID,
    });

    if (payload.tid !== TENANT_ID) {
      return res.status(403).json({ error: "Wrong tenant." });
    }
    if (!payload.oid) {
      return res.status(403).json({ error: "Token missing oid claim." });
    }

    const user = {
      oid: payload.oid,
      email: payload.preferred_username || payload.upn || payload.email || "",
      name: payload.name || "",
    };
    req.user = user;

    try {
      await upsertUser(user);
    } catch (dbErr) {
      console.error("[auth] upsertUser failed:", dbErr);
      return res.status(503).json({ error: "Auth backend temporarily unavailable." });
    }

    return next();
  } catch (err) {
    console.error("[auth] jwt verify failed:", err);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = { requireAuth };

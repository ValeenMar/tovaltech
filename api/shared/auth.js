// api/shared/auth.js
'use strict';

const jwt    = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

// ─── Config (env vars) ────────────────────────────────────────────────────────
// ENTRA_TENANT_ID      : Azure AD / Entra External ID tenant GUID
// ENTRA_AUDIENCE       : App registration client ID (or array of allowed audiences)
// ENTRA_AUTHORITY_HOST : defaults to https://login.microsoftonline.com

const TENANT_ID      = process.env.ENTRA_TENANT_ID;
const AUDIENCE       = process.env.ENTRA_AUDIENCE;
const AUTHORITY_HOST = process.env.ENTRA_AUTHORITY_HOST || 'https://login.microsoftonline.com';

// JWKS client — one instance per process, caches keys in memory
const jwksClient = jwksRsa({
  jwksUri:             `${AUTHORITY_HOST}/${TENANT_ID}/discovery/v2.0/keys`,
  cache:               true,
  cacheMaxEntries:     10,
  cacheMaxAge:         86400000,  // 24 h
  rateLimit:           true,
  jwksRequestsPerMinute: 10,
});

// ─── Valid roles ──────────────────────────────────────────────────────────────
const VALID_ROLES = Object.freeze(['CUSTOMER', 'SELLER', 'OPS', 'ADMIN']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the Bearer token from the Authorization header.
 * @param {object} req  Azure Functions HTTP request object
 * @returns {string|null}
 */
function _extractToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return null;

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  return parts[1];
}

/**
 * Callback for jsonwebtoken to fetch the signing key.
 */
function _getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'auth: failed to retrieve signing key',
        kid: header.kid,
        error: err.message,
      }));
      return callback(err);
    }
    callback(null, key.getPublicKey());
  });
}

/**
 * Validates the JWT and returns the decoded payload.
 * @param {string} token
 * @returns {Promise<object>} decoded JWT claims
 */
function _verifyToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      algorithms: ['RS256'],
      audience:   AUDIENCE,
      issuer:     [
        `${AUTHORITY_HOST}/${TENANT_ID}/v2.0`,
        `https://sts.windows.net/${TENANT_ID}/`,
      ],
    };

    jwt.verify(token, _getSigningKey, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

/**
 * Extracts roles from a decoded JWT.
 * Microsoft Entra emits roles either in:
 *   - `roles` claim  (application roles assigned via app registration)
 *   - `extension_roles` claim (custom attribute, some External ID configs)
 *
 * @param {object} decoded
 * @returns {string[]}  uppercase role names
 */
function _extractRoles(decoded) {
  const raw = decoded.roles || decoded.extension_roles || [];
  const arr  = Array.isArray(raw) ? raw : [raw];
  return arr
    .filter(Boolean)
    .map((r) => String(r).toUpperCase())
    .filter((r) => VALID_ROLES.includes(r));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates the JWT on the incoming request and enriches it with caller info.
 *
 * On success, attaches to req:
 *   req.caller = { sub, email, name, roles: string[], token: string }
 *
 * @param {object} req               Azure Functions HTTP request
 * @param {string[]} [requiredRoles] If provided, at least one role must match
 * @returns {Promise<{ caller: object }|{ status: number, body: object }>}
 *   Returns the caller info on success, or an HTTP error shape on failure.
 *   Callers should check result.status to detect auth failures.
 */
async function requireAuth(req, requiredRoles = []) {
  // 1. Extract token
  const token = _extractToken(req);
  if (!token) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'auth: missing Authorization header',
    }));
    return { status: 401, body: { error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' } };
  }

  // 2. Verify signature & claims
  let decoded;
  try {
    decoded = await _verifyToken(token);
  } catch (err) {
    console.warn(JSON.stringify({
      level: 'warn',
      message: 'auth: token verification failed',
      error: err.message,
    }));

    const isExpired = err.name === 'TokenExpiredError';
    return {
      status: 401,
      body: {
        error: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Token has expired' : 'Token is invalid or untrusted',
      },
    };
  }

  // 3. Extract roles
  const roles = _extractRoles(decoded);

  // 4. RBAC check (server-side, not just UI)
  if (requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((r) => roles.includes(r.toUpperCase()));
    if (!hasRole) {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'auth: insufficient roles',
        sub:           decoded.sub,
        requiredRoles,
        callerRoles:   roles,
      }));
      return {
        status: 403,
        body: {
          error: 'FORBIDDEN',
          message: `Required role(s): ${requiredRoles.join(', ')}. Caller has: ${roles.join(', ') || 'none'}`,
        },
      };
    }
  }

  // 5. Build caller object
  const caller = {
    sub:   decoded.sub   || decoded.oid || null,
    email: decoded.email || decoded.preferred_username || null,
    name:  decoded.name  || null,
    roles,
    token,
  };

  // Attach to request for downstream use
  req.caller = caller;

  console.log(JSON.stringify({
    level: 'info',
    message: 'auth: request authenticated',
    sub:   caller.sub,
    email: caller.email,
    roles: caller.roles,
  }));

  return { caller };
}

/**
 * Helper: returns true if the auth result represents a failure.
 * Allows cleaner guard clauses in function handlers.
 *
 * @example
 * const authResult = await requireAuth(req, ['ADMIN', 'OPS']);
 * if (isAuthError(authResult)) return authResult;
 */
function isAuthError(result) {
  return typeof result.status === 'number' && result.status >= 400;
}

module.exports = {
  requireAuth,
  isAuthError,
  VALID_ROLES,
};

// api/shared/response.js
'use strict';

const { v4: uuidv4 } = (() => {
  // node:crypto is available in Node 18+ without extra deps
  try {
    const { randomUUID } = require('crypto');
    return { v4: randomUUID };
  } catch {
    // Fallback: simple RFC 4122-compliant v4 UUID
    return {
      v4: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
    };
  }
})();

// ─── Correlation ID ──────────────────────────────────────────────────────────

/**
 * Resolves the correlation ID from the request or generates a new one.
 * Checks: X-Correlation-Id → X-Request-Id → new UUID
 */
function resolveCorrelationId(req) {
  if (!req || !req.headers) return uuidv4();
  return (
    req.headers['x-correlation-id'] ||
    req.headers['X-Correlation-Id'] ||
    req.headers['x-request-id'] ||
    uuidv4()
  );
}

// ─── Base builder ─────────────────────────────────────────────────────────────

/**
 * Builds the standard Azure Functions HTTP response object.
 */
function _build(statusCode, body, req, extraHeaders = {}) {
  const correlationId = resolveCorrelationId(req);

  return {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// ─── Success responses ────────────────────────────────────────────────────────

/**
 * 200 OK
 * @param {*}      data   Payload to serialize
 * @param {object} [req]  Incoming request (for correlation ID)
 */
function ok(data, req) {
  return _build(200, { data }, req);
}

/**
 * 201 Created
 */
function created(data, req) {
  return _build(201, { data }, req);
}

/**
 * 204 No Content
 */
function noContent(req) {
  const correlationId = resolveCorrelationId(req);
  return {
    status: 204,
    headers: {
      'X-Correlation-Id': correlationId,
    },
    body: '',
  };
}

// ─── Client error responses ───────────────────────────────────────────────────

/**
 * 400 Bad Request
 * @param {string|string[]} message  Validation error(s)
 */
function badRequest(message, req) {
  const errors = Array.isArray(message) ? message : [message];
  return _build(400, { error: 'BAD_REQUEST', messages: errors }, req);
}

/**
 * 401 Unauthorized
 */
function unauthorized(message, req) {
  return _build(401, {
    error:   'UNAUTHORIZED',
    message: message || 'Authentication required',
  }, req, { 'WWW-Authenticate': 'Bearer' });
}

/**
 * 403 Forbidden
 */
function forbidden(message, req) {
  return _build(403, {
    error:   'FORBIDDEN',
    message: message || 'You do not have permission to perform this action',
  }, req);
}

/**
 * 404 Not Found
 */
function notFound(message, req) {
  return _build(404, {
    error:   'NOT_FOUND',
    message: message || 'Resource not found',
  }, req);
}

/**
 * 409 Conflict
 */
function conflict(message, req) {
  return _build(409, {
    error:   'CONFLICT',
    message: message || 'Resource already exists or state conflict',
  }, req);
}

/**
 * 422 Unprocessable Entity
 */
function unprocessable(message, req) {
  return _build(422, {
    error:   'UNPROCESSABLE',
    message: message || 'The request was well-formed but could not be processed',
  }, req);
}

// ─── Server error responses ───────────────────────────────────────────────────

/**
 * 500 Internal Server Error
 *
 * Logs the full error internally; never leaks stack traces to the client.
 *
 * @param {Error|string} err   The caught error
 * @param {object}       [req] Incoming request
 */
function serverError(err, req) {
  const correlationId = resolveCorrelationId(req);
  const message = err instanceof Error ? err.message : String(err);

  // Structured log for Application Insights
  console.error(JSON.stringify({
    level:         'error',
    message:       'Unhandled server error',
    error:         message,
    stack:         err instanceof Error ? err.stack : undefined,
    correlationId,
  }));

  return _build(500, {
    error:         'INTERNAL_SERVER_ERROR',
    message:       'An unexpected error occurred. Please try again or contact support.',
    correlationId,
  }, req);
}

/**
 * 503 Service Unavailable
 */
function serviceUnavailable(message, req) {
  return _build(503, {
    error:   'SERVICE_UNAVAILABLE',
    message: message || 'The service is temporarily unavailable',
  }, req, { 'Retry-After': '30' });
}

// ─── Auth result pass-through helper ─────────────────────────────────────────

/**
 * If the result of requireAuth() is a failure, maps it directly to our
 * standard response format and attaches the correlation ID.
 *
 * Usage in a function handler:
 *   const authResult = await requireAuth(req, ['ADMIN']);
 *   if (isAuthError(authResult)) return fromAuthError(authResult, req);
 */
function fromAuthError(authResult, req) {
  const { status, body } = authResult;
  return _build(status, body, req);
}

// ─── Paginated response ───────────────────────────────────────────────────────

/**
 * Wraps a page of results with pagination metadata.
 * @param {object[]} items
 * @param {number}   total       Total record count (from SQL COUNT OVER())
 * @param {number}   page        Current page (1-based)
 * @param {number}   pageSize
 * @param {object}   [req]
 */
function paged(items, total, page, pageSize, req) {
  return _build(200, {
    data: items,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext:    page * pageSize < total,
      hasPrev:    page > 1,
    },
  }, req);
}

module.exports = {
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  serverError,
  serviceUnavailable,
  fromAuthError,
  paged,
  resolveCorrelationId,
};

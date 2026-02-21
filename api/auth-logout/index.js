/**
 * api/auth-logout/index.js
 *
 * POST /api/auth-logout
 *
 * Limpia la cookie del JWT. Simple y efectivo.
 */

const { buildClearCookie } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: {
      ...HEADERS,
      'Set-Cookie': buildClearCookie(),
    },
    body: { ok: true },
  };
};

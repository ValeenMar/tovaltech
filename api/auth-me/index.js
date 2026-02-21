/**
 * api/auth-me/index.js
 *
 * GET /api/auth-me
 *
 * Lee el JWT de la cookie y devuelve los datos del usuario logueado.
 * El frontend lo llama al iniciar para saber si hay sesión activa.
 */

const connectDB = require('../db');
const { getTokenFromRequest, verifyToken } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  const token = getTokenFromRequest(req);

  if (!token) {
    context.res = { status: 401, headers: HEADERS, body: { error: 'no_session' } };
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    context.res = { status: 401, headers: HEADERS, body: { error: 'token_invalido' } };
    return;
  }

  try {
    const pool = await connectDB();

    // Revalidar contra DB por si el usuario fue eliminado
    const result = await pool.request()
      .input('id', payload.id)
      .query(`
        SELECT id, name, last_name, email, confirmed
        FROM dbo.tovaltech_users
        WHERE id = @id AND confirmed = 1
      `);

    if (!result.recordset.length) {
      context.res = { status: 401, headers: HEADERS, body: { error: 'usuario_no_encontrado' } };
      return;
    }

    const user = result.recordset[0];

    context.res = {
      status: 200,
      headers: HEADERS,
      body: {
        ok: true,
        user: {
          id:       user.id,
          name:     user.name,
          lastName: user.last_name,
          email:    user.email,
        },
      },
    };

  } catch (err) {
    context.log.error('auth_me_error', err.message);
    context.res = { status: 500, headers: HEADERS, body: { error: 'internal_error' } };
  }
};

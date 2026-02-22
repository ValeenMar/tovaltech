/**
 * api/auth-me/index.js
 *
 * GET /api/auth-me
 *
 * Lee el JWT de la cookie y devuelve los datos del usuario logueado.
 * El frontend lo llama al iniciar para saber si hay sesión activa.
 */

const connectDB = require('../db');
const { getTokenFromRequest, verifyToken, getUsersSchema } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  const token = getTokenFromRequest(req);

  if (!token) {
    context.res = { status: 200, headers: HEADERS, body: { ok: false, error: 'no_session' } };
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    context.res = { status: 200, headers: HEADERS, body: { ok: false, error: 'token_invalido' } };
    return;
  }

  try {
    const pool = await connectDB();
    const schema = await getUsersSchema(pool);

    if (!schema.tableExists) {
      context.log.error('auth_me_schema_missing', 'dbo.tovaltech_users no existe');
      context.res = { status: 500, headers: HEADERS, body: { error: 'auth_schema_missing' } };
      return;
    }

    // Revalidar contra DB por si el usuario fue eliminado.
    const result = await pool.request()
      .input('id', payload.id)
      .query(`
        SELECT id, name${schema.hasLastName ? ', last_name' : ''}, email${schema.hasConfirmed ? ', confirmed' : ''}
        FROM dbo.tovaltech_users
        WHERE id = @id${schema.hasConfirmed ? ' AND confirmed = 1' : ''}
      `);

    if (!result.recordset.length) {
      context.res = { status: 200, headers: HEADERS, body: { ok: false, error: 'usuario_no_encontrado' } };
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
          lastName: user.last_name || '',
          email:    user.email,
        },
      },
    };

  } catch (err) {
    context.log.error('auth_me_error', err.message);
    context.res = { status: 500, headers: HEADERS, body: { error: 'internal_error' } };
  }
};

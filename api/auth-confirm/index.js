/**
 * api/auth-confirm/index.js
 *
 * GET /api/auth-confirm?token=<token>
 *
 * Confirma el email del usuario. El frontend llama a este endpoint
 * cuando el usuario hace click en el link del email.
 * Después de confirmar, devuelve el JWT en cookie para loguearlo automáticamente.
 */

const connectDB  = require('../db');
const { signToken, buildSetCookie, getUsersSchema } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  const token = req.query?.token;

  if (!token) {
    context.res = { status: 400, headers: HEADERS, body: { error: 'token_requerido' } };
    return;
  }

  try {
    const pool = await connectDB();
    const schema = await getUsersSchema(pool);

    if (!schema.tableExists) {
      context.log.error('auth_confirm_schema_missing', 'dbo.tovaltech_users no existe');
      context.res = { status: 500, headers: HEADERS, body: { error: 'auth_schema_missing' } };
      return;
    }

    if (!schema.canUseEmailConfirmation) {
      context.res = { status: 400, headers: HEADERS, body: { error: 'confirmation_disabled' } };
      return;
    }

    // Buscar usuario por token
    const result = await pool.request()
      .input('token', token)
      .query(`
        SELECT id, name${schema.hasLastName ? ', last_name' : ''}, email, confirmed, confirm_expires
        FROM dbo.tovaltech_users
        WHERE confirm_token = @token
      `);

    if (!result.recordset.length) {
      context.res = { status: 404, headers: HEADERS, body: { error: 'token_invalido' } };
      return;
    }

    const user = result.recordset[0];

    if (user.confirmed) {
      // Ya estaba confirmado — igual lo logueamos
      const jwt = signToken({ id: user.id, email: user.email, name: user.name });
      context.res = {
        status: 200,
        headers: { ...HEADERS, 'Set-Cookie': buildSetCookie(jwt) },
        body: { ok: true, message: 'ya_confirmado', user: { name: user.name, email: user.email } },
      };
      return;
    }

    // Verificar expiración
    if (user.confirm_expires && new Date(user.confirm_expires) < new Date()) {
      context.res = { status: 410, headers: HEADERS, body: { error: 'token_expirado' } };
      return;
    }

    // Confirmar usuario
    const setFields = ['confirmed = 1', 'confirm_token = NULL', 'confirm_expires = NULL'];
    if (schema.hasUpdatedAt) setFields.push('updated_at = GETDATE()');

    await pool.request()
      .input('id', user.id)
      .query(`
        UPDATE dbo.tovaltech_users
        SET ${setFields.join(', ')}
        WHERE id = @id
      `);

    // Loguear automáticamente
    const jwt = signToken({ id: user.id, email: user.email, name: user.name });

    context.res = {
      status: 200,
      headers: {
        ...HEADERS,
        'Set-Cookie': buildSetCookie(jwt),
      },
      body: {
        ok: true,
        message: 'confirmed',
        user: { name: user.name, lastName: user.last_name || '', email: user.email },
      },
    };

  } catch (err) {
    context.log.error('auth_confirm_error', err.message);
    context.res = { status: 500, headers: HEADERS, body: { error: 'internal_error' } };
  }
};

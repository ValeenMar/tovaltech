/**
 * api/auth-login/index.js
 *
 * POST /api/auth-login
 * Body: { email, password }
 *
 * Verifica credenciales y devuelve el JWT en cookie HttpOnly.
 */

const bcrypt    = require('bcryptjs');
const connectDB = require('../db');
const { signToken, buildSetCookie } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    return;
  }

  const { email, password } = req.body || {};

  if (!email?.trim() || !password) {
    context.res = { status: 400, headers: HEADERS, body: { error: 'email_y_password_requeridos' } };
    return;
  }

  try {
    const pool = await connectDB();

    const result = await pool.request()
      .input('email', email.trim().toLowerCase())
      .query(`
        SELECT id, name, last_name, email, password_hash, confirmed
        FROM dbo.tovaltech_users
        WHERE email = @email
      `);

    if (!result.recordset.length) {
      // Respuesta genérica para no revelar si el email existe
      context.res = { status: 401, headers: HEADERS, body: { error: 'credenciales_incorrectas' } };
      return;
    }

    const user = result.recordset[0];

    // Verificar contraseña (siempre comparar aunque el usuario no exista, para evitar timing attacks)
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      context.res = { status: 401, headers: HEADERS, body: { error: 'credenciales_incorrectas' } };
      return;
    }

    if (!user.confirmed) {
      context.res = { status: 403, headers: HEADERS, body: { error: 'email_sin_confirmar' } };
      return;
    }

    const jwt = signToken({ id: user.id, email: user.email, name: user.name });

    context.res = {
      status: 200,
      headers: {
        ...HEADERS,
        'Set-Cookie': buildSetCookie(jwt),
      },
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
    context.log.error('auth_login_error', err.message);
    context.res = { status: 500, headers: HEADERS, body: { error: 'internal_error' } };
  }
};

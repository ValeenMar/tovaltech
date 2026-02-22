/**
 * api/auth-register/index.js
 *
 * POST /api/auth-register
 * Body: { name, lastName, email, password }
 *
 * Crea el usuario, hashea la contraseña y manda el email de confirmación.
 * El usuario queda con confirmed=0 hasta que haga click en el link.
 *
 * Variables de entorno necesarias: JWT_SECRET, RESEND_KEY, SITE_URL
 */

const bcrypt     = require('bcryptjs');
const connectDB  = require('../db');
const { generateConfirmToken, sendConfirmEmail } = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    return;
  }

  const { name, lastName = '', email, password } = req.body || {};

  // ── Validaciones básicas ──────────────────────────────────────────────────
  if (!name?.trim() || !email?.trim() || !password) {
    context.res = { status: 400, headers: HEADERS, body: { error: 'nombre_email_password_requeridos' } };
    return;
  }

  const emailLower = email.trim().toLowerCase();
  const emailRx    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(emailLower)) {
    context.res = { status: 400, headers: HEADERS, body: { error: 'email_invalido' } };
    return;
  }

  if (password.length < 8) {
    context.res = { status: 400, headers: HEADERS, body: { error: 'password_muy_corto' } };
    return;
  }

  try {
    const pool = await connectDB();

    // ── Verificar si el email ya existe ──────────────────────────────────────
    const existing = await pool.request()
      .input('email', emailLower)
      .query(`SELECT id, confirmed FROM dbo.tovaltech_users WHERE email = @email`);

    if (existing.recordset.length > 0) {
      const row = existing.recordset[0];
      if (row.confirmed) {
        context.res = { status: 409, headers: HEADERS, body: { error: 'email_ya_registrado' } };
      } else {
        // Ya existe pero sin confirmar → reenviar el email de confirmación
        const token   = generateConfirmToken();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.request()
          .input('token',   token)
          .input('expires', expires)
          .input('email',   emailLower)
          .query(`
            UPDATE dbo.tovaltech_users
            SET confirm_token = @token, confirm_expires = @expires, updated_at = GETDATE()
            WHERE email = @email
          `);

        await sendConfirmEmail({ to: emailLower, name: name.trim(), token });

        context.res = {
          status: 200,
          headers: HEADERS,
          body: { ok: true, message: 'confirmation_resent' },
        };
      }
      return;
    }

    // ── Crear usuario ─────────────────────────────────────────────────────────
    const hash    = await bcrypt.hash(password, 12);
    const token   = generateConfirmToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hs

    await pool.request()
      .input('name',           name.trim())
      .input('last_name',      lastName.trim())
      .input('email',          emailLower)
      .input('password_hash',  hash)
      .input('confirm_token',  token)
      .input('confirm_expires', expires)
      .query(`
        INSERT INTO dbo.tovaltech_users
          (name, last_name, email, password_hash, confirmed, confirm_token, confirm_expires)
        VALUES
          (@name, @last_name, @email, @password_hash, 0, @confirm_token, @confirm_expires)
      `);

    await sendConfirmEmail({ to: emailLower, name: name.trim(), token });

    context.res = {
      status: 201,
      headers: HEADERS,
      body: { ok: true, message: 'registered_confirm_sent' },
    };

  } catch (err) {
    context.log.error('auth_register_error', err.message);
    context.res = {
      status: 500,
      headers: HEADERS,
      body: { error: 'internal_error' },
    };
  }
};

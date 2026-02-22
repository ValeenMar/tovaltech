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
const {
  generateConfirmToken,
  sendConfirmEmail,
  isEmailConfirmationRequired,
  getUsersSchema,
} = require('../auth-utils');

const HEADERS = { 'content-type': 'application/json' };

module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    return;
  }

  const { name, lastName = '', email, password } = req.body || {};
  const requireEmailConfirm = isEmailConfirmationRequired();

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
    const schema = await getUsersSchema(pool);
    const canConfirmFlow = requireEmailConfirm && schema.canUseEmailConfirmation;

    if (!schema.tableExists) {
      context.log.error('auth_register_schema_missing', 'dbo.tovaltech_users no existe');
      context.res = { status: 500, headers: HEADERS, body: { error: 'auth_schema_missing' } };
      return;
    }

    if (!schema.hasCoreColumns) {
      context.log.error('auth_register_schema_invalid', JSON.stringify(schema));
      context.res = { status: 500, headers: HEADERS, body: { error: 'auth_schema_invalid' } };
      return;
    }

    if (requireEmailConfirm && !schema.canUseEmailConfirmation) {
      context.log.warn('auth_register_confirm_disabled_by_schema', JSON.stringify(schema));
    }

    // ── Verificar si el email ya existe ──────────────────────────────────────
    const existing = await pool.request()
      .input('email', emailLower)
      .query(`
        SELECT TOP 1 id, name${schema.hasConfirmed ? ', confirmed' : ''}
        FROM dbo.tovaltech_users
        WHERE email = @email
      `);

    if (existing.recordset.length > 0) {
      const row = existing.recordset[0];
      const rowConfirmed = schema.hasConfirmed ? Boolean(row.confirmed) : true;

      if (rowConfirmed) {
        context.res = { status: 409, headers: HEADERS, body: { error: 'email_ya_registrado' } };
      } else {
        if (canConfirmFlow) {
          // Ya existe pero sin confirmar -> reenviar email.
          const token = generateConfirmToken();
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const updateSet = ['confirm_token = @token', 'confirm_expires = @expires'];
          if (schema.hasUpdatedAt) updateSet.push('updated_at = GETDATE()');

          await pool.request()
            .input('token', token)
            .input('expires', expires)
            .input('email', emailLower)
            .query(`
              UPDATE dbo.tovaltech_users
              SET ${updateSet.join(', ')}
              WHERE email = @email
            `);

          try {
            await sendConfirmEmail({ to: emailLower, name: row.name || name.trim(), token });
          } catch (mailErr) {
            context.log.error('auth_register_resend_email_error', mailErr.message);
            context.res = {
              status: 502,
              headers: HEADERS,
              body: { error: 'confirmation_email_failed' },
            };
            return;
          }

          context.res = {
            status: 200,
            headers: HEADERS,
            body: { ok: true, message: 'confirmation_resent' },
          };
        } else {
          // Modo sin confirmacion obligatoria: activar cuenta existente pendiente.
          if (schema.hasConfirmed) {
            const setFields = ['confirmed = 1'];
            if (schema.hasUpdatedAt) setFields.push('updated_at = GETDATE()');
            await pool.request()
              .input('id', row.id)
              .query(`
                UPDATE dbo.tovaltech_users
                SET ${setFields.join(', ')}
                WHERE id = @id
              `);
          }

          context.res = {
            status: 200,
            headers: HEADERS,
            body: { ok: true, message: 'account_activated' },
          };
        }
      }
      return;
    }

    // ── Crear usuario ─────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(password, 12);
    if (canConfirmFlow) {
      const token = generateConfirmToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hs
      const columns = ['name', 'email', 'password_hash', 'confirmed', 'confirm_token', 'confirm_expires'];
      const values = ['@name', '@email', '@password_hash', '0', '@confirm_token', '@confirm_expires'];
      if (schema.hasLastName) {
        columns.splice(1, 0, 'last_name');
        values.splice(1, 0, '@last_name');
      }

      const insertReq = pool.request()
        .input('name', name.trim())
        .input('email', emailLower)
        .input('password_hash', hash)
        .input('confirm_token', token)
        .input('confirm_expires', expires);

      if (schema.hasLastName) {
        insertReq.input('last_name', lastName.trim());
      }

      await insertReq.query(`
        INSERT INTO dbo.tovaltech_users (${columns.join(', ')})
        VALUES (${values.join(', ')})
      `);

      try {
        await sendConfirmEmail({ to: emailLower, name: name.trim(), token });
      } catch (mailErr) {
        context.log.error('auth_register_send_email_error', mailErr.message);
        context.res = {
          status: 502,
          headers: HEADERS,
          body: { error: 'confirmation_email_failed' },
        };
        return;
      }

      context.res = {
        status: 201,
        headers: HEADERS,
        body: { ok: true, message: 'registered_confirm_sent' },
      };
    } else {
      const columns = ['name', 'email', 'password_hash'];
      const values = ['@name', '@email', '@password_hash'];
      if (schema.hasLastName) {
        columns.splice(1, 0, 'last_name');
        values.splice(1, 0, '@last_name');
      }
      if (schema.hasConfirmed) {
        columns.push('confirmed');
        values.push('1');
      }

      const insertReq = pool.request()
        .input('name', name.trim())
        .input('email', emailLower)
        .input('password_hash', hash);

      if (schema.hasLastName) {
        insertReq.input('last_name', lastName.trim());
      }

      await insertReq.query(`
        INSERT INTO dbo.tovaltech_users (${columns.join(', ')})
        VALUES (${values.join(', ')})
      `);

      context.res = {
        status: 201,
        headers: HEADERS,
        body: { ok: true, message: 'registered_ok' },
      };
    }

  } catch (err) {
    context.log.error('auth_register_error', err.message);
    context.res = {
      status: 500,
      headers: HEADERS,
      body: { error: 'internal_error' },
    };
  }
};

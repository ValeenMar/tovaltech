const connectDB = require('../db');
const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');
const { getTokenFromRequest, verifyToken, getUsersSchema } = require('../auth-utils');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ZONES = new Set(['CABA', 'GBA', 'interior']);

function cleanText(value, max = 120) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 160).toLowerCase();
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    phone: row.phone || '',
    zone: row.zone || 'CABA',
    address: row.address || '',
    city: row.city || '',
  };
}

function selectProfileQuery(schema) {
  return `
    SELECT
      id,
      name,
      ${schema.hasLastName ? 'last_name' : "CAST('' AS NVARCHAR(120)) AS last_name"},
      email,
      ${schema.hasPhone ? 'phone' : "CAST('' AS NVARCHAR(40)) AS phone"},
      ${schema.hasZone ? 'zone' : "CAST('CABA' AS NVARCHAR(24)) AS zone"},
      ${schema.hasAddress ? 'address' : "CAST('' AS NVARCHAR(200)) AS address"},
      ${schema.hasCity ? 'city' : "CAST('' AS NVARCHAR(120)) AS city"}
    FROM dbo.tovaltech_users
    WHERE id = @id
  `;
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

  if (req.method !== 'GET' && req.method !== 'PUT') {
    sendJson(context, {
      status: 405,
      traceId,
      body: { error: 'method_not_allowed', trace_id: traceId },
    });
    return;
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: false, error: 'no_session', trace_id: traceId },
    });
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: false, error: 'token_invalid', trace_id: traceId },
    });
    return;
  }

  try {
    const pool = await connectDB();
    const schema = await getUsersSchema(pool);

    if (!schema.tableExists || !schema.hasCoreColumns) {
      sendJson(context, {
        status: 500,
        traceId,
        body: { error: 'auth_schema_invalid', trace_id: traceId },
      });
      return;
    }

    const currentRes = await pool.request()
      .input('id', payload.id)
      .query(selectProfileQuery(schema));

    if (!currentRes.recordset.length) {
      sendJson(context, {
        status: 200,
        traceId,
        body: { ok: false, error: 'user_not_found', trace_id: traceId },
      });
      return;
    }

    const current = mapProfile(currentRes.recordset[0]);

    if (req.method === 'GET') {
      sendJson(context, {
        status: 200,
        traceId,
        body: { ok: true, profile: current, trace_id: traceId },
      });
      return;
    }

    const body = req.body || {};
    const next = {
      name: body.name !== undefined ? cleanText(body.name, 80) : current.name,
      lastName: body.lastName !== undefined ? cleanText(body.lastName, 80) : current.lastName,
      email: body.email !== undefined ? cleanEmail(body.email) : current.email,
      phone: body.phone !== undefined ? cleanText(body.phone, 32) : current.phone,
      zone: body.zone !== undefined ? cleanText(body.zone, 24) : current.zone,
      address: body.address !== undefined ? cleanText(body.address, 180) : current.address,
      city: body.city !== undefined ? cleanText(body.city, 80) : current.city,
    };

    if (!next.name) {
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'name_required', trace_id: traceId },
      });
      return;
    }

    if (schema.hasLastName && !next.lastName) {
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'last_name_required', trace_id: traceId },
      });
      return;
    }

    if (!next.email || !EMAIL_RE.test(next.email)) {
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'email_invalid', trace_id: traceId },
      });
      return;
    }

    if (next.zone && !VALID_ZONES.has(next.zone)) {
      sendJson(context, {
        status: 400,
        traceId,
        body: { error: 'zone_invalid', trace_id: traceId },
      });
      return;
    }

    const currentEmail = String(current.email || '').toLowerCase();
    if (next.email !== currentEmail) {
      const emailRes = await pool.request()
        .input('email', next.email)
        .input('id', payload.id)
        .query(`
          SELECT TOP 1 id
          FROM dbo.tovaltech_users
          WHERE email = @email
            AND id <> @id
        `);
      if (emailRes.recordset.length) {
        sendJson(context, {
          status: 409,
          traceId,
          body: { error: 'email_already_in_use', trace_id: traceId },
        });
        return;
      }
    }

    const setClauses = ['name = @name', 'email = @email'];
    if (schema.hasLastName) setClauses.push('last_name = @last_name');
    if (schema.hasPhone) setClauses.push('phone = @phone');
    if (schema.hasZone) setClauses.push('zone = @zone');
    if (schema.hasAddress) setClauses.push('address = @address');
    if (schema.hasCity) setClauses.push('city = @city');
    if (schema.hasUpdatedAt) setClauses.push('updated_at = GETDATE()');

    const updateReq = pool.request()
      .input('id', payload.id)
      .input('name', next.name)
      .input('email', next.email);

    if (schema.hasLastName) updateReq.input('last_name', next.lastName);
    if (schema.hasPhone) updateReq.input('phone', next.phone);
    if (schema.hasZone) updateReq.input('zone', next.zone || 'CABA');
    if (schema.hasAddress) updateReq.input('address', next.address);
    if (schema.hasCity) updateReq.input('city', next.city);

    await updateReq.query(`
      UPDATE dbo.tovaltech_users
      SET ${setClauses.join(', ')}
      WHERE id = @id
    `);

    const finalRes = await pool.request()
      .input('id', payload.id)
      .query(selectProfileQuery(schema));

    const profile = mapProfile(finalRes.recordset[0]);
    logWithTrace(context, 'info', traceId, 'account_profile_updated', {
      user_id: payload.id,
      email: profile.email,
    });

    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: true, profile, trace_id: traceId },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'account_profile_error', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'internal_error', trace_id: traceId },
    });
  }
};

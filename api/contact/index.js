const { sendJson } = require('../_shared/http');
const { getTraceId, logWithTrace } = require('../_shared/trace');

const WEB3FORMS_API = 'https://api.web3forms.com/submit';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function (context, req) {
  const traceId = getTraceId(req);

  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: { 'x-trace-id': traceId },
    };
    return;
  }

  if (req.method !== 'POST') {
    sendJson(context, {
      status: 405,
      traceId,
      body: { error: 'method_not_allowed', trace_id: traceId },
    });
    return;
  }

  const key = process.env.WEB3FORMS_ACCESS_KEY;
  if (!key) {
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'config_missing', trace_id: traceId },
    });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || !email || !subject || !message) {
    sendJson(context, {
      status: 400,
      traceId,
      body: { error: 'invalid_payload', trace_id: traceId },
    });
    return;
  }

  if (!isValidEmail(email)) {
    sendJson(context, {
      status: 400,
      traceId,
      body: { error: 'invalid_email', trace_id: traceId },
    });
    return;
  }

  try {
    const response = await fetch(WEB3FORMS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        access_key: key,
        name,
        email,
        subject,
        message,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      logWithTrace(context, 'warn', traceId, 'contact_submit_failed', {
        status: response.status,
      });
      sendJson(context, {
        status: 502,
        traceId,
        body: { error: 'contact_provider_failed', trace_id: traceId },
      });
      return;
    }

    logWithTrace(context, 'info', traceId, 'contact_submit_ok', { email });
    sendJson(context, {
      status: 200,
      traceId,
      body: { ok: true },
    });
  } catch (err) {
    logWithTrace(context, 'error', traceId, 'contact_submit_exception', { error: err.message });
    sendJson(context, {
      status: 500,
      traceId,
      body: { error: 'contact_failed', trace_id: traceId },
    });
  }
};

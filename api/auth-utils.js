// api/auth-utils.js
// Utilidades compartidas para el sistema de auth de compradores

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const COOKIE_NAME = 'tovaltech_auth';
const JWT_EXPIRY  = '1y';

// ── JWT ──────────────────────────────────────────────────────────────────────

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.verify(token, secret);
}

// ── Cookie ───────────────────────────────────────────────────────────────────

function buildSetCookie(token) {
  const maxAge = 365 * 24 * 60 * 60;
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV !== 'development' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function buildClearCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

function getTokenFromRequest(req) {
  const cookieHeader = req.headers?.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

// ── Confirm token ─────────────────────────────────────────────────────────────

function generateConfirmToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Email via Resend ──────────────────────────────────────────────────────────

async function sendConfirmEmail({ to, name, token }) {
  const RESEND_KEY = process.env.RESEND_KEY;
  const SITE_URL   = (process.env.SITE_URL || 'https://www.tovaltech.com.ar').replace(/\/$/, '');

  if (!RESEND_KEY) throw new Error('RESEND_KEY no configurado');

  const confirmUrl = `${SITE_URL}/confirmar?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;text-align:center;vertical-align:middle;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="6" height="6" rx="1"/>
                    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                </td>
                <td style="padding-left:12px;">
                  <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.3px;">
                    Toval<span style="color:rgba(255,255,255,.75)">Tech</span>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
              Hola, ${name} 👋
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Gracias por registrarte en TovalTech. Solo falta un paso: confirmá tu dirección de email haciendo click en el botón de abajo.
            </p>
            <a href="${confirmUrl}"
               style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;
                      text-decoration:none;padding:14px 32px;border-radius:10px;">
              Confirmar mi cuenta
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
              Este enlace vence en 24 horas. Si no creaste una cuenta en TovalTech, podés ignorar este email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
              © ${new Date().getFullYear()} TovalTech · Buenos Aires, Argentina · <a href="https://www.tovaltech.com.ar" style="color:#d1d5db;">tovaltech.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'TovalTech <no-reply@tovaltech.com.ar>',
      to:      [to],
      subject: 'Confirmá tu cuenta en TovalTech',
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

module.exports = {
  signToken,
  verifyToken,
  buildSetCookie,
  buildClearCookie,
  getTokenFromRequest,
  generateConfirmToken,
  sendConfirmEmail,
};

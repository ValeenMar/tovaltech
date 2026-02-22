const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\s().-]{6,24}$/;

function cleanText(value, max = 120) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text.slice(0, max);
}

function normalizeBuyer(input) {
  return {
    name: cleanText(input?.name, 80),
    lastName: cleanText(input?.lastName, 80),
    email: cleanText(input?.email, 160).toLowerCase(),
    phone: cleanText(input?.phone, 32),
    address: cleanText(input?.address, 160),
    city: cleanText(input?.city, 80),
    zone: cleanText(input?.zone, 24),
  };
}

function validateBuyer(input) {
  const buyer = normalizeBuyer(input);

  if (!buyer.name) return { ok: false, error: 'buyer_name_required' };
  if (!buyer.lastName) return { ok: false, error: 'buyer_last_name_required' };
  if (!buyer.email || !EMAIL_RE.test(buyer.email)) return { ok: false, error: 'buyer_email_invalid' };
  if (!buyer.phone || !PHONE_RE.test(buyer.phone)) return { ok: false, error: 'buyer_phone_invalid' };
  if (buyer.address && buyer.address.length < 4) return { ok: false, error: 'buyer_address_invalid' };

  return { ok: true, buyer };
}

module.exports = {
  normalizeBuyer,
  validateBuyer,
};

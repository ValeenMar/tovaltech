import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateBuyer, normalizeBuyer } = require('./buyer');

describe('buyer validation', () => {
  it('normalizes and validates a correct buyer payload', () => {
    const result = validateBuyer({
      name: '  Vale ',
      lastName: ' Mar ',
      email: ' VALE@MAIL.COM ',
      phone: ' +54 11 1234-5678 ',
      address: ' Av. Siempre Viva 123 ',
    });

    expect(result.ok).toBe(true);
    expect(result.buyer.email).toBe('vale@mail.com');
    expect(result.buyer.name).toBe('Vale');
  });

  it('rejects malformed email and phone', () => {
    const badEmail = validateBuyer({
      name: 'A',
      lastName: 'B',
      email: 'invalid-email',
      phone: '+54 11 1234 5678',
    });
    expect(badEmail.ok).toBe(false);
    expect(badEmail.error).toBe('buyer_email_invalid');

    const badPhone = validateBuyer({
      name: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: 'xx',
    });
    expect(badPhone.ok).toBe(false);
    expect(badPhone.error).toBe('buyer_phone_invalid');
  });

  it('trims long fields to configured limits', () => {
    const normalized = normalizeBuyer({
      name: 'x'.repeat(200),
      lastName: 'y'.repeat(200),
      city: 'z'.repeat(300),
    });

    expect(normalized.name.length).toBeLessThanOrEqual(80);
    expect(normalized.lastName.length).toBeLessThanOrEqual(80);
    expect(normalized.city.length).toBeLessThanOrEqual(80);
  });
});

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { requireAdminIfRequested, requireAdmin } = require('./require-admin');

function makePrincipal(roles) {
  return Buffer.from(JSON.stringify({ userRoles: roles }), 'utf8').toString('base64');
}

describe('require-admin helpers', () => {
  it('forbids admin mode without admin role', () => {
    const req = {
      query: { admin: '1' },
      headers: {},
    };
    const result = requireAdminIfRequested(req);
    expect(result.forbidden).toBe(true);
    expect(result.isAdmin).toBe(false);
  });

  it('allows admin mode with admin role', () => {
    const req = {
      query: { admin: '1' },
      headers: { 'x-ms-client-principal': makePrincipal(['authenticated', 'admin']) },
    };
    const result = requireAdminIfRequested(req);
    expect(result.forbidden).toBe(false);
    expect(result.isAdmin).toBe(true);
  });

  it('returns false when admin mode was not requested', () => {
    const req = {
      query: {},
      headers: { 'x-ms-client-principal': makePrincipal(['authenticated']) },
    };
    const result = requireAdminIfRequested(req);
    expect(result.forbidden).toBe(false);
    expect(result.isAdmin).toBe(false);
  });

  it('checks strict admin requirement', () => {
    const req = {
      headers: { 'x-ms-client-principal': makePrincipal(['authenticated', 'admin']) },
    };
    expect(requireAdmin(req).isAdmin).toBe(true);
  });
});

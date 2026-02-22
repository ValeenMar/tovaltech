// Shared helpers for Azure SWA client principal parsing.

function getClientPrincipal(req) {
  try {
    const encoded = req.headers?.['x-ms-client-principal'];
    if (!encoded) return null;
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getUserRoles(req) {
  const principal = getClientPrincipal(req);
  const roles = principal?.userRoles;
  return Array.isArray(roles) ? roles : [];
}

function hasRole(req, role) {
  return getUserRoles(req).includes(role);
}

module.exports = {
  getClientPrincipal,
  getUserRoles,
  hasRole,
};

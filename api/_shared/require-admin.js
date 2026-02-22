const { hasRole } = require('./client-principal');

function isAdminRequest(req) {
  return hasRole(req, 'admin');
}

function isAdminModeRequested(req) {
  return req?.query?.admin === '1';
}

function requireAdminIfRequested(req) {
  const wantsAdmin = isAdminModeRequested(req);
  const isAdmin = wantsAdmin ? isAdminRequest(req) : false;
  return {
    wantsAdmin,
    isAdmin,
    forbidden: wantsAdmin && !isAdmin,
  };
}

function requireAdmin(req) {
  return {
    isAdmin: isAdminRequest(req),
  };
}

module.exports = {
  isAdminRequest,
  isAdminModeRequested,
  requireAdminIfRequested,
  requireAdmin,
};

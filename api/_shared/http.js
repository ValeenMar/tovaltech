function jsonHeaders(traceId, extra = {}) {
  return {
    'content-type': 'application/json',
    'x-trace-id': traceId,
    ...extra,
  };
}

function sendJson(context, { status = 200, body = {}, traceId = '', headers = {} }) {
  context.res = {
    status,
    headers: jsonHeaders(traceId, headers),
    body,
  };
}

module.exports = {
  jsonHeaders,
  sendJson,
};

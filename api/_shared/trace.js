const { randomUUID } = require('crypto');

function getTraceId(req) {
  const fromHeader = req?.headers?.['x-trace-id'];
  if (fromHeader && String(fromHeader).trim()) return String(fromHeader).trim();
  return randomUUID();
}

function logWithTrace(context, level, traceId, event, payload = {}) {
  const logger = context.log?.[level] || context.log;
  logger.call(context.log, event, { trace_id: traceId, ...payload });
}

module.exports = {
  getTraceId,
  logWithTrace,
};

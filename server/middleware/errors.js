export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} was not found.` } });
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  const status = Number(err.status || err.statusCode || 500);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } });
  }
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((item) => item.message);
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Some submitted data is invalid.', details } });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE_VALUE', message: 'An account with that email already exists.' } });
  }
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message = safeStatus >= 500 ? 'An unexpected server error occurred.' : err.message;
  if (safeStatus >= 500) console.error('[Reflow API]', err);
  return res.status(safeStatus).json({ error: { code: err.code || 'REQUEST_FAILED', message } });
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

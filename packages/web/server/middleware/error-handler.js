module.exports = function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
};

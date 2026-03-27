const notFoundHandler = (req, res, next) => {
  res.status(404).json({ error: 'NOT_FOUND' });
};

const errorHandler = (err, req, res, next) => {
  const status = Number(err.statusCode || err.status || 500);
  const message = status >= 500 ? 'INTERNAL_ERROR' : String(err.message || 'BAD_REQUEST');

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
};

module.exports = { notFoundHandler, errorHandler };


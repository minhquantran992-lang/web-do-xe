const httpError = (statusCode, message) => {
  const code = Number(statusCode) || 500;
  const err = new Error(String(message || 'INTERNAL_ERROR'));
  err.statusCode = code;
  return err;
};

module.exports = { httpError };

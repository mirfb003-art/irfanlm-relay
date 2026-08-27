/**
 * Auth middleware
 * Every request (except GET /) must include the header:
 *   X-Relay-Token: <your AUTH_SECRET from .env>
 * The extension sends this header on every API call.
 */
module.exports = (req, res, next) => {
  const token = req.headers['x-relay-token'];
  if (!token || token !== process.env.AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing X-Relay-Token header' });
  }
  next();
};

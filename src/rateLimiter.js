const rateLimit = require("express-rate-limit");

const shortenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a minute." }
});

module.exports = {
  shortenLimiter
};

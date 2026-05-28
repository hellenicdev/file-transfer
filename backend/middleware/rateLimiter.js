const rateLimit = require('express-rate-limit');

const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many rooms created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const joinRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many join attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { createRoomLimiter, joinRoomLimiter, uploadLimiter };

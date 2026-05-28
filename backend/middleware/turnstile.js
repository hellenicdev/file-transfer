const axios = require('axios');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(req, res, next) {
  const token = req.body.turnstileToken;

  if (!token) {
    return res.status(400).json({ error: 'Turnstile token is required' });
  }

  try {
    const response = await axios.post(TURNSTILE_VERIFY_URL, {
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });

    if (!response.data.success) {
      return res.status(403).json({
        error: 'CAPTCHA verification failed',
        details: response.data['error-codes'],
      });
    }

    next();
  } catch (err) {
    console.error('Turnstile verification error:', err.message);
    return res.status(500).json({ error: 'CAPTCHA verification service error' });
  }
}

module.exports = { verifyTurnstile };

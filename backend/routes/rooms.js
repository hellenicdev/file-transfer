const express = require('express');
const crypto = require('crypto');
const Room = require('../models/Room');
const File = require('../models/File');
const { verifyTurnstile } = require('../middleware/turnstile');
const { createRoomLimiter, joinRoomLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

function generateRoomId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

router.post('/create', createRoomLimiter, verifyTurnstile, async (req, res) => {
  try {
    let roomId;
    let attempts = 0;

    do {
      roomId = generateRoomId();
      attempts++;
    } while (await Room.findOne({ roomId }) && attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique room ID' });
    }

    const room = new Room({ roomId });
    await room.save();

    res.status(201).json({ roomId });
  } catch (err) {
    console.error('Create room error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join', joinRoomLimiter, verifyTurnstile, async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.status(404).json({ error: 'Room not found or expired' });
    }

    room.updateActivity();

    res.json({ roomId: room.roomId });
  } catch (err) {
    console.error('Join room error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });
    if (!room) {
      return res.status(404).json({ exists: false });
    }
    res.json({ exists: true, roomId: room.roomId });
  } catch (err) {
    console.error('Get room error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:roomId/files', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.updateActivity();

    const files = await File.find({ roomId: room.roomId })
      .sort({ uploadedAt: -1 })
      .select('-__v');

    res.json({ files });
  } catch (err) {
    console.error('Get files error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

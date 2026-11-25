const mongoose = require('mongoose');

// Rooms are deleted after this many seconds without activity (default 24h).
// Previously the TTL was 0, so MongoDB removed rooms within ~60s of the last activity.
const ROOM_TTL_SECONDS = parseInt(process.env.ROOM_TTL_SECONDS, 10) || 24 * 60 * 60;

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: { expires: ROOM_TTL_SECONDS },
  },
  usersConnected: {
    type: Number,
    default: 0,
  },
});


roomSchema.methods.updateActivity = function () {
  this.lastActive = new Date();
  return this.save().catch((err) => {
    console.error('Room activity update failed:', err.message);
  });
};

module.exports = mongoose.model('Room', roomSchema);

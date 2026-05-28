const mongoose = require('mongoose');

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
    index: { expires: 0 },
  },
  usersConnected: {
    type: Number,
    default: 0,
  },
});

roomSchema.index({ lastActive: 1 }, { expireAfterSeconds: 0 });

roomSchema.methods.updateActivity = function () {
  this.lastActive = new Date();
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);

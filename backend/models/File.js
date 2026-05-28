const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  gridFSId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
    default: 'application/octet-stream',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploaderId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('File', fileSchema);

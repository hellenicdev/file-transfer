const express = require('express');
const Room = require('../models/Room');
const FileModel = require('../models/File');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadToGridFS, downloadFromGridFS, deleteFromGridFS } = require('../gridfs/bucket');

const mongoose = require('mongoose');

const router = express.Router();

const ROOM_ID_RE = /^[A-F0-9]{6}$/;

// Run multer manually so its errors (size/type) get proper status codes
// instead of falling through to the generic 500 handler.
function handleUpload(req, res, next) {
  upload.array('files', 10)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files (max 10 per upload)' });
    }
    if (err.message && err.message.startsWith('File type')) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  });
}

function validFileId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  next();
}

function contentDisposition(name) {
  const fallback = String(name).replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

router.post('/upload/:roomId', uploadLimiter, handleUpload, async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    if (!ROOM_ID_RE.test(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found or expired' });
    }

    const { uploaderId } = req.body;
    if (!uploaderId || typeof uploaderId !== 'string' || uploaderId.length > 100) {
      return res.status(400).json({ error: 'uploaderId is required' });
    }

    room.updateActivity();

    const savedFiles = [];

    for (const file of req.files) {
      const gridFSId = await uploadToGridFS(file.buffer, file.originalname, file.mimetype);

      const fileDoc = new FileModel({
        roomId,
        gridFSId,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploaderId,
      });

      await fileDoc.save();
      savedFiles.push({
        _id: fileDoc._id,
        originalName: fileDoc.originalName,
        size: fileDoc.size,
        mimeType: fileDoc.mimeType,
        uploadedAt: fileDoc.uploadedAt,
        uploaderId: fileDoc.uploaderId,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('file-uploaded', { files: savedFiles });
    }

    res.status(201).json({ files: savedFiles });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    if (err.message && err.message.startsWith('File type')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:fileId/download', validFileId, async (req, res) => {
  try {
    const file = await FileModel.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const room = await Room.findOne({ roomId: file.roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found or expired' });
    }

    room.updateActivity();

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(file.originalName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', file.size);

    const stream = downloadFromGridFS(file.gridFSId);
    stream.on('error', (err) => {
      console.error('Download stream error:', err.message);
      if (!res.headersSent) {
        res.removeHeader('Content-Disposition');
        res.removeHeader('Content-Length');
        res.status(500).json({ error: 'Download failed' });
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

router.delete('/:fileId', validFileId, async (req, res) => {
  try {
    const file = await FileModel.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { uploaderId } = req.body;
    if (!uploaderId || file.uploaderId !== uploaderId) {
      return res.status(403).json({ error: 'You can only delete your own uploads' });
    }

    await deleteFromGridFS(file.gridFSId);
    await FileModel.findByIdAndDelete(req.params.fileId);

    const io = req.app.get('io');
    if (io) {
      io.to(`room-${file.roomId}`).emit('file-deleted', { fileId: req.params.fileId });
    }

    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;

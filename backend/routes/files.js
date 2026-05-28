const express = require('express');
const Room = require('../models/Room');
const FileModel = require('../models/File');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadToGridFS, downloadFromGridFS, deleteFromGridFS } = require('../gridfs/bucket');

const router = express.Router();

router.post('/upload/:roomId', uploadLimiter, upload.array('files', 10), async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found or expired' });
    }

    const { uploaderId } = req.body;
    if (!uploaderId) {
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

router.get('/:fileId/download', async (req, res) => {
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
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    const stream = downloadFromGridFS(file.gridFSId);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('Download stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

router.delete('/:fileId', async (req, res) => {
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

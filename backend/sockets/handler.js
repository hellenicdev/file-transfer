const Room = require('../models/Room');

const roomUsers = new Map();

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, uploaderId }) => {
      if (!roomId || !uploaderId) return;

      socket.join(`room-${roomId}`);

      socket.roomId = roomId;
      socket.uploaderId = uploaderId;

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      roomUsers.get(roomId).set(socket.id, uploaderId);

      const count = roomUsers.get(roomId).size;

      try {
        await Room.findOneAndUpdate(
          { roomId },
          { $set: { lastActive: new Date(), usersConnected: count } },
          { upsert: false }
        );
      } catch (err) {
        console.error('Socket room update error:', err.message);
      }

      io.to(`room-${roomId}`).emit('room-users', { count });
      socket.to(`room-${roomId}`).emit('user-joined', { uploaderId });
    });

    socket.on('disconnect', async () => {
      const { roomId, uploaderId } = socket;

      if (roomId && roomUsers.has(roomId)) {
        roomUsers.get(roomId).delete(socket.id);

        const count = roomUsers.get(roomId).size;
        if (count === 0) {
          roomUsers.delete(roomId);
        }

        try {
          await Room.findOneAndUpdate(
            { roomId },
            { $set: { lastActive: new Date(), usersConnected: count } }
          );
        } catch (err) {
          console.error('Socket disconnect update error:', err.message);
        }

        io.to(`room-${roomId}`).emit('room-users', { count });
        io.to(`room-${roomId}`).emit('user-left', { uploaderId });
      }

      console.log(`Socket disconnected: ${socket.id}`);
    });

    socket.on('leave-room', () => {
      const { roomId, uploaderId } = socket;

      if (roomId) {
        socket.leave(`room-${roomId}`);

        if (roomUsers.has(roomId)) {
          roomUsers.get(roomId).delete(socket.id);
          const count = roomUsers.get(roomId).size;
          if (count === 0) roomUsers.delete(roomId);

          Room.findOneAndUpdate(
            { roomId },
            { $set: { lastActive: new Date(), usersConnected: count } }
          ).catch((err) => console.error('Socket leave update error:', err.message));

          io.to(`room-${roomId}`).emit('room-users', { count });
          io.to(`room-${roomId}`).emit('user-left', { uploaderId });
        }
      }

      socket.roomId = null;
      socket.uploaderId = null;
    });
  });
}

function getRoomUsers(roomId) {
  const users = roomUsers.get(roomId);
  return users ? users.size : 0;
}

module.exports = { initSocket, getRoomUsers };

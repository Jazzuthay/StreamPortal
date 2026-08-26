const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const rooms = new Map();
let dbConnected = false;

const roomSchema = new mongoose.Schema({
  id:               { type: String, required: true, unique: true },
  name:             { type: String, default: '' },
  createdAt:        { type: String },
  bytesUsed:        { type: Number, default: 0 },
  bytesLimit:       { type: Number, default: 0 },
  sessionSeconds:   { type: Number, default: 0 },
  resolutionTier:   { type: String, default: null },
  resolutionWidth:  { type: Number, default: 0 },
  resolutionHeight: { type: Number, default: 0 },
  overlayMode:      { type: String, default: 'logo' },
}, { _id: false, versionKey: false });

const RoomModel = mongoose.model('Room', roomSchema);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[rooms] MONGODB_URI not set — rooms stored in memory only (will not survive restart)');
    return;
  }
  try {
    await mongoose.connect(uri);
    dbConnected = true;
    const docs = await RoomModel.find().lean();
    for (const doc of docs) {
      rooms.set(doc.id, {
        ...doc,
        senderJoined: false,
        receiverJoined: false,
        senderConnectedAt: null,
      });
    }
    console.log(`[rooms] Connected to MongoDB, loaded ${rooms.size} room(s)`);
  } catch (err) {
    console.error('[rooms] MongoDB connection failed:', err.message);
  }
}

function dbSave(room) {
  if (!dbConnected) return;
  const { senderJoined, receiverJoined, senderConnectedAt, ...data } = room;
  RoomModel.findOneAndUpdate({ id: data.id }, data, { upsert: true })
    .catch((e) => console.warn('[rooms] DB write error:', e.message));
}

function dbDelete(id) {
  if (!dbConnected) return;
  RoomModel.deleteOne({ id }).catch((e) => console.warn('[rooms] DB delete error:', e.message));
}

function createRoom(name, bytesLimit = 0) {
  const id = randomUUID().slice(0, 8);
  const room = {
    id,
    name,
    createdAt: new Date().toISOString(),
    senderJoined: false,
    receiverJoined: false,
    bytesUsed: 0,
    bytesLimit: Math.max(0, Number(bytesLimit) || 0),
    sessionSeconds: 0,
    resolutionTier: null,
    resolutionWidth: 0,
    resolutionHeight: 0,
    senderConnectedAt: null,
    overlayMode: 'logo',
  };
  rooms.set(id, room);
  dbSave(room);
  return room;
}

function getRooms() {
  return Array.from(rooms.values());
}

function getRoom(id) {
  return rooms.get(id) || null;
}

function deleteRoom(id) {
  const deleted = rooms.delete(id);
  if (deleted) dbDelete(id);
  return deleted;
}

function updateRoom(id, updates) {
  const room = rooms.get(id);
  if (!room) return null;
  Object.assign(room, updates);
  // Only write to DB for fields worth persisting (skip high-frequency in-session stats)
  if (
    updates.name !== undefined ||
    updates.bytesLimit !== undefined ||
    updates.sessionSeconds !== undefined ||
    updates.resolutionTier !== undefined ||
    updates.overlayMode !== undefined
  ) {
    dbSave(room);
  }
  return room;
}

module.exports = { connectDB, createRoom, getRooms, getRoom, deleteRoom, updateRoom };

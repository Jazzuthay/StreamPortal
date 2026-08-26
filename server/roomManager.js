const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const PERSIST_FILE = process.env.ROOMS_DATA_PATH || path.join(__dirname, 'rooms.json');

// Load rooms persisted from previous run
const rooms = new Map();
try {
  const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
  const saved = JSON.parse(raw);
  for (const room of saved) {
    // Reset transient join state on restart but keep room config
    room.senderJoined   = false;
    room.receiverJoined = false;
    room.senderConnectedAt = null;
    rooms.set(room.id, room);
  }
  console.log(`[rooms] Loaded ${rooms.size} room(s) from disk`);
} catch {
  // File missing or unreadable — start fresh
}

function persist() {
  try {
    fs.writeFileSync(PERSIST_FILE, JSON.stringify(Array.from(rooms.values()), null, 2));
  } catch (e) {
    console.warn('[rooms] Could not persist rooms:', e.message);
  }
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
  persist();
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
  if (deleted) persist();
  return deleted;
}

function updateRoom(id, updates) {
  const room = rooms.get(id);
  if (!room) return null;
  Object.assign(room, updates);
  // Only persist fields that matter long-term (skip high-frequency stats)
  if (updates.name !== undefined || updates.bytesLimit !== undefined ||
      updates.sessionSeconds !== undefined || updates.resolutionTier !== undefined) {
    persist();
  }
  return room;
}

module.exports = { createRoom, getRooms, getRoom, deleteRoom, updateRoom };

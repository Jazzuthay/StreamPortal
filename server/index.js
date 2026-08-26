require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const authRouter = require('./auth');
const verifyToken = require('./middleware/verifyToken');
const { connectDB, createRoom, getRooms, getRoom, deleteRoom, updateRoom } = require('./roomManager');

let RtcTokenBuilder, RtcRole;
try {
  ({ RtcTokenBuilder, RtcRole } = require('agora-token'));
} catch {
  console.warn('[agora] agora-token package not installed — token endpoint disabled');
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'none'"],  // API returns JSON — block all content loading
      frameAncestors:["'none'"],  // prevent embedding in iframes
    },
  },
  crossOriginEmbedderPolicy: false, // WebRTC / SharedArrayBuffer compatibility
}));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api', authRouter);

// Agora token — channel=roomId, role=sender|receiver
app.get('/api/agora-token', (req, res) => {
  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId) return res.status(503).json({ error: 'AGORA_APP_ID not configured on server' });

  // Without a certificate, return null token (works when Auth Mode = "No Auth" in Agora console)
  if (!certificate || !RtcTokenBuilder) {
    return res.json({ token: null, appId });
  }

  const { channel = '', role = 'receiver' } = req.query;
  const expire = 86400; // 24 hours in seconds
  const agoraRole = (role === 'sender' || role === 'receiver') ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, certificate, channel, 0, agoraRole, expire, expire);

  res.json({ token, appId });
});

// Room routes (protected)
app.post('/api/rooms', verifyToken, (req, res) => {
  const { name, bytesLimit } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  const room = createRoom(name.trim(), bytesLimit);
  res.status(201).json(room);
});

app.patch('/api/rooms/:id', verifyToken, (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { bytesLimit } = req.body;
  const updates = {};
  if (typeof bytesLimit === 'number') updates.bytesLimit = Math.max(0, bytesLimit);
  res.json(updateRoom(req.params.id, updates));
});

app.get('/api/rooms', verifyToken, (req, res) => {
  res.json(getRooms());
});

app.get('/api/rooms/:id', (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.delete('/api/rooms/:id', verifyToken, (req, res) => {
  const deleted = deleteRoom(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Room not found' });
  res.json({ success: true });
});

// Agora usage summary — monthly participant-minutes tracked in memory
app.get('/api/usage', verifyToken, (req, res) => {
  const curMonth = new Date().toISOString().slice(0, 7);
  if (monthlyStats.month !== curMonth) monthlyStats = freshMonthlyStats();

  const tiers = monthlyStats.tiers;
  const totalMinutes = Object.values(tiers).reduce((a, b) => a + b, 0);
  const remainingFree = Math.max(0, FREE_TIER_MINUTES - totalMinutes);
  const estimatedCost = Object.entries(tiers).reduce((sum, [tier, mins]) => {
    if (mins <= 0) return sum;
    return sum + (mins / 1000) * (TIER_PRICE[tier] || 0);
  }, 0);

  // Live session seconds: add time since sender connected for active rooms
  const rooms = getRooms();
  const liveSeconds = rooms.reduce((acc, r) => {
    if (!r.senderConnectedAt) return acc;
    return acc + Math.round((Date.now() - r.senderConnectedAt) / 1000);
  }, 0);

  res.json({
    month: curMonth,
    tiers,
    totalMinutes: Math.round(totalMinutes),
    remainingFree: Math.round(remainingFree),
    freeTierLimit: FREE_TIER_MINUTES,
    estimatedCostUSD: parseFloat(estimatedCost.toFixed(4)),
    liveSessionSeconds: liveSeconds,
    note: 'In-memory — resets on server restart. For authoritative data use Agora Console.',
  });
});

// ── Agora resolution tier helper ──────────────────────────────────────────────
// Tiers match Agora pricing: https://www.agora.io/en/pricing/video-calling/
function resolutionTier(w, h) {
  const px = (w || 0) * (h || 0);
  if (!px)          return 'audio';
  if (px <= 921600) return 'hd';       // ≤ 1280×720
  if (px <= 2073600) return 'full-hd'; // ≤ 1920×1080
  if (px <= 3686400) return '2k';      // ≤ 2560×1440
  return '2k+';
}

// ── Monthly in-memory stats (resets when server restarts) ─────────────────────
const TIER_PRICE = { audio: 0.99, hd: 3.99, 'full-hd': 8.99, '2k': 15.99, '2k+': 35.99 };
const FREE_TIER_MINUTES = 10000;

function freshMonthlyStats() {
  return { month: new Date().toISOString().slice(0, 7), tiers: { audio: 0, hd: 0, 'full-hd': 0, '2k': 0, '2k+': 0 } };
}
let monthlyStats = freshMonthlyStats();

// ── Room presence tracking (no WebRTC signaling — Agora handles media) ─────────
const roomSockets = {};

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Agora stats: bandwidth + resolution reported by client every 5 s
  socket.on('webrtc-stats', ({ roomId, deltaBytes, width, height, role }) => {
    const room = getRoom(roomId);
    if (!room) return;

    // Reset monthly stats if calendar month changed
    const curMonth = new Date().toISOString().slice(0, 7);
    if (monthlyStats.month !== curMonth) monthlyStats = freshMonthlyStats();

    const updates = {};
    if (deltaBytes > 0) updates.bytesUsed = (room.bytesUsed || 0) + deltaBytes;

    // Resolution comes from the sender (has the camera)
    if (role === 'sender' && width && height) {
      const tier = resolutionTier(width, height);
      updates.resolutionTier   = tier;
      updates.resolutionWidth  = width;
      updates.resolutionHeight = height;
    }

    updateRoom(roomId, updates);

    // Monthly participant-minutes: each 5-second report = 5/60 min per participant
    const deltaMin = 5 / 60;
    const tier = resolutionTier(width, height);
    monthlyStats.tiers[tier] = (monthlyStats.tiers[tier] || 0) + deltaMin;
  });

  socket.on('join-room', ({ roomId, role, password }) => {
    console.log(`[socket] join-room roomId=${roomId} role=${role} socket=${socket.id}`);

    if (!roomSockets[roomId]) {
      roomSockets[roomId] = { sender: null, receiver: null, participant1: null, participant2: null, spectators: [] };
    }
    const slots = roomSockets[roomId];

    if (role === 'spectator') {
      const expected = process.env.AdminView_PASSWORD;
      if (!expected) { socket.emit('spectator-auth-failed'); return; }
      if (password !== expected) {
        socket.emit('spectator-auth-failed');
        console.log(`[socket] spectator wrong password roomId=${roomId}`);
        return;
      }
      if (!slots.spectators) slots.spectators = [];
      slots.spectators.push(socket.id);
      socket.join(roomId);
      socket.emit('spectator-joined');
      console.log(`[socket] spectator joined room ${roomId}`);
      return;
    }

    if (role === 'participant') {
      if (!slots.participant1) {
        slots.participant1 = socket.id;
        socket.join(roomId);
      } else if (!slots.participant2) {
        slots.participant2 = socket.id;
        socket.join(roomId);
      } else {
        socket.emit('role-taken', { role: 'participant' });
        console.log(`[socket] meeting full roomId=${roomId}`);
      }
      return;
    }

    // Both broadcast slots occupied — block 3rd person entirely
    if (slots.sender && slots.receiver) {
      socket.emit('room-full');
      console.log(`[socket] room-full roomId=${roomId}`);
      return;
    }

    if (slots[role]) {
      socket.emit('role-taken', { role });
      console.log(`[socket] role-taken roomId=${roomId} role=${role}`);
      return;
    }

    slots[role] = socket.id;
    socket.join(roomId);
    const joinUpdates = { [`${role}Joined`]: true };
    if (role === 'sender') joinUpdates.senderConnectedAt = Date.now();
    updateRoom(roomId, joinUpdates);
  });

  function clearSocketFromRooms(socketId) {
    for (const [roomId, slots] of Object.entries(roomSockets)) {
      if (slots.participant1 === socketId) {
        slots.participant1 = null;
        if (slots.participant2) io.to(slots.participant2).emit('peer-disconnected', { role: 'participant' });
        console.log(`[socket] participant1 left room ${roomId}`);
      } else if (slots.participant2 === socketId) {
        slots.participant2 = null;
        if (slots.participant1) io.to(slots.participant1).emit('peer-disconnected', { role: 'participant' });
        console.log(`[socket] participant2 left room ${roomId}`);
      } else if (slots.sender === socketId) {
        slots.sender = null;
        const room = getRoom(roomId);
        const extraSecs = room?.senderConnectedAt
          ? Math.round((Date.now() - room.senderConnectedAt) / 1000)
          : 0;
        updateRoom(roomId, {
          senderJoined: false,
          senderConnectedAt: null,
          sessionSeconds: (room?.sessionSeconds || 0) + extraSecs,
        });
        if (slots.receiver) io.to(slots.receiver).emit('peer-disconnected', { role: 'sender' });
        console.log(`[socket] sender left room ${roomId}`);
      } else if (slots.receiver === socketId) {
        slots.receiver = null;
        updateRoom(roomId, { receiverJoined: false });
        if (slots.sender) io.to(slots.sender).emit('peer-disconnected', { role: 'receiver' });
        console.log(`[socket] receiver left room ${roomId}`);
      }
      if (slots.spectators) {
        const idx = slots.spectators.indexOf(socketId);
        if (idx !== -1) {
          slots.spectators.splice(idx, 1);
          console.log(`[socket] spectator left room ${roomId}`);
        }
      }
    }
  }

  // Overlay control — sender sets overlay mode, relayed to receiver
  socket.on('set-overlay', ({ roomId, mode }) => {
    const slots = roomSockets[roomId];
    if (!slots) return;
    updateRoom(roomId, { overlayMode: mode });
    if (slots.receiver) io.to(slots.receiver).emit('set-overlay', { mode });
  });

  // Admin remote-mute relay — only spectators can send this
  socket.on('admin-control', ({ roomId, target, type, muted }) => {
    const slots = roomSockets[roomId];
    if (!slots || !slots.spectators?.includes(socket.id)) return;
    const targetSocketId = slots[target]; // 'sender' or 'receiver'
    if (targetSocketId) {
      io.to(targetSocketId).emit('admin-control', { type, muted });
      console.log(`[socket] admin-control → ${target} type=${type} muted=${muted}`);
    }
  });

  socket.on('leave-room', () => {
    console.log(`[socket] leave-room socket=${socket.id}`);
    clearSocketFromRooms(socket.id);
    socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    clearSocketFromRooms(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`StreamPortal server running on port ${PORT}`);
  });
});

import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';
import MeetingView from '../components/MeetingView.jsx';
import SenderView from '../components/SenderView.jsx';
import ReceiverView from '../components/ReceiverView.jsx';
import SpectatorView from '../components/SpectatorView.jsx';


function IconStreamer() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="5" fill="white" />
      <path d="M15 33 Q9 24 15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M33 15 Q39 24 33 33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 39 Q2 24 9 9"   stroke="white" strokeWidth="2"   strokeLinecap="round" opacity="0.55" />
      <path d="M39 9 Q46 24 39 39" stroke="white" strokeWidth="2"   strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function IconViewer() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="10" width="40" height="28" rx="3" stroke="white" strokeWidth="2.5" />
      <line x1="16" y1="38" x2="32" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="38" x2="24" y2="44" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="20,17 20,31 34,24" fill="white" />
    </svg>
  );
}

function IconSpectator() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <path d="M24 10 C10 10 2 24 2 24 C2 24 10 38 24 38 C38 38 46 24 46 24 C46 24 38 10 24 10 Z"
            stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="7" stroke="white" strokeWidth="2.5" fill="none"/>
      <circle cx="24" cy="24" r="3" fill="white"/>
    </svg>
  );
}

function IconFaceToFace() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <circle cx="14" cy="16" r="6" stroke="white" strokeWidth="2.5" />
      <path d="M3 40 C3 31 8 27 14 27 C20 27 25 31 25 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="16" r="6" stroke="white" strokeWidth="2.5" />
      <path d="M23 40 C23 31 28 27 34 27 C40 27 45 31 45 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function RoleCard({ icon, label, link, onOpen, selected, onSelect }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button onClick={onSelect} className="flex flex-col items-center gap-4 group">
        <div className={`w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] lg:w-[200px] lg:h-[200px] rounded-full flex items-center justify-center shadow-xl transition-all duration-150 group-active:scale-95 [&_svg]:w-[52px] [&_svg]:h-[52px] sm:[&_svg]:w-[60px] sm:[&_svg]:h-[60px] lg:[&_svg]:w-[72px] lg:[&_svg]:h-[72px] ${
          selected ? 'bg-[#6d1fc0] shadow-[#8B2BE2]/40 ring-4 ring-[#8B2BE2]/30' : 'bg-[#8B2BE2] shadow-[#8B2BE2]/25 group-hover:bg-[#7B1BD2]'
        }`}>
          {icon}
        </div>
        <span className="text-gray-900 font-semibold text-sm tracking-widest uppercase">{label}</span>
      </button>

      {selected && (
        <div className="w-full bg-white border border-[#e8e0f5] rounded-2xl p-3 shadow-lg shadow-[#8B2BE2]/10 space-y-2">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Direct link</p>
          <div className="bg-[#f8f5ff] rounded-xl px-3 py-2">
            <p className="text-[11px] text-gray-600 font-mono break-all leading-relaxed">{link}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpen}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#8B2BE2] hover:bg-[#7B1BD2] text-white text-xs font-semibold transition-colors"
            >
              <ExternalIcon /> Open here
            </button>
            <button
              onClick={copyLink}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                copied ? 'bg-green-50 border-green-300 text-green-700' : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-600 hover:border-[#8B2BE2] hover:text-[#8B2BE2]'
              }`}
            >
              <CopyIcon /> {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const [room,          setRoom]          = useState(null);
  const [notFound,      setNotFound]      = useState(false);
  const [inMeeting,     setInMeeting]     = useState(false);
  const [broadcastRole, setBroadcastRole] = useState(null);
  const [selectedRole,  setSelectedRole]  = useState(null);
  const [joinError,          setJoinError]          = useState('');
  const [showSpectatorModal, setShowSpectatorModal] = useState(false);
  const [spectatorPassword,  setSpectatorPassword]  = useState('');
  const [spectatorError,     setSpectatorError]     = useState('');

  const origin = window.location.origin;
  const roleLinks = {
    sender:   `${origin}/room/${roomId}?role=sender`,
    receiver: `${origin}/room/${roomId}?role=receiver`,
    meeting:  `${origin}/room/${roomId}?role=meeting`,
    admin:    `${origin}/room/${roomId}?role=admin`,
  };

  useEffect(() => {
    apiFetch(`/api/rooms/${roomId}`)
      .then((res) => { if (!res.ok) { setNotFound(true); return null; } return res.json(); })
      .then((data) => {
        if (!data) return;
        setRoom(data);
        // Auto-join if ?role= param is present
        const role = searchParams.get('role');
        if (role === 'sender')   { socket.emit('join-room', { roomId, role: 'sender' });   setBroadcastRole('sender'); }
        if (role === 'receiver') { socket.emit('join-room', { roomId, role: 'receiver' }); setBroadcastRole('receiver'); }
        if (role === 'meeting')  { setInMeeting(true); }
        if (role === 'admin')    { setShowSpectatorModal(true); }
      })
      .catch(() => setNotFound(true));

    socket.on('role-taken', ({ role: takenRole }) => {
      if (takenRole === 'participant') {
        setJoinError('This meeting is full — only 2 participants allowed.');
        setInMeeting(false);
      } else if (takenRole === 'sender') {
        setJoinError('Someone is already broadcasting in this room.');
        setBroadcastRole(null);
      } else if (takenRole === 'receiver') {
        setJoinError('Viewer slot is already taken.');
        setBroadcastRole(null);
      }
    });

    socket.on('room-full', () => {
      setJoinError('This broadcast is full — sender and receiver are both connected.');
      setBroadcastRole(null);
      setInMeeting(false);
    });

    socket.on('spectator-auth-failed', () => {
      setSpectatorError('Wrong password. Try again.');
    });

    socket.on('spectator-joined', () => {
      setShowSpectatorModal(false);
      setBroadcastRole('spectator');
    });

    return () => {
      socket.off('role-taken');
      socket.off('room-full');
      socket.off('spectator-auth-failed');
      socket.off('spectator-joined');
    };
  }, [roomId]);

  function handleJoinBroadcast(role) {
    setJoinError('');
    socket.emit('join-room', { roomId, role });
    setBroadcastRole(role);
  }

  function handleLeaveBroadcast() {
    socket.emit('leave-room');
    setBroadcastRole(null);
  }

  function handleSpectatorSubmit(e) {
    e.preventDefault();
    setSpectatorError('');
    socket.emit('join-room', { roomId, role: 'spectator', password: spectatorPassword });
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff] px-6">
      <div className="text-center">
        <p className="text-xl font-bold text-gray-900 mb-2">Room not found</p>
        <p className="text-gray-500 text-sm">This room may have been deleted or the link is invalid.</p>
      </div>
    </div>
  );

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff]">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Loading…
      </div>
    </div>
  );

  if (inMeeting)
    return <MeetingView roomId={roomId} onLeave={() => setInMeeting(false)} />;

  if (broadcastRole === 'sender')
    return <SenderView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  if (broadcastRole === 'receiver')
    return <ReceiverView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  if (broadcastRole === 'spectator')
    return <SpectatorView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f5ff] px-6 py-10">

      {/* Logo */}
      <div className="flex flex-col items-center mb-10 lg:mb-16">
        <img src="/holobox911-logo.png" alt="HoloBox911" className="w-64 sm:w-72 lg:w-96 object-contain mb-2" />
        <p className="text-[#8B2BE2] text-sm font-semibold tracking-widest uppercase mb-4">Live stream</p>

        <p className="text-gray-500 text-base font-medium">Let's Explore</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-400" />
          <span className="text-gray-500 text-sm">{room.name}</span>
        </div>
      </div>

      {/* Role cards — 2×2 grid */}
      <div className="grid grid-cols-2 gap-6 sm:gap-10 lg:gap-14 w-full max-w-sm sm:max-w-lg lg:max-w-2xl">
        <RoleCard
          icon={<IconStreamer />}
          label="Streamer"
          link={roleLinks.sender}
          selected={selectedRole === 'sender'}
          onSelect={() => { setSelectedRole(selectedRole === 'sender' ? null : 'sender'); setJoinError(''); }}
          onOpen={() => handleJoinBroadcast('sender')}
        />
        <RoleCard
          icon={<IconViewer />}
          label="Viewer"
          link={roleLinks.receiver}
          selected={selectedRole === 'receiver'}
          onSelect={() => { setSelectedRole(selectedRole === 'receiver' ? null : 'receiver'); setJoinError(''); }}
          onOpen={() => handleJoinBroadcast('receiver')}
        />
        <RoleCard
          icon={<IconFaceToFace />}
          label="Face to Face"
          link={roleLinks.meeting}
          selected={selectedRole === 'meeting'}
          onSelect={() => { setSelectedRole(selectedRole === 'meeting' ? null : 'meeting'); setJoinError(''); }}
          onOpen={() => { setJoinError(''); setInMeeting(true); }}
        />
        <RoleCard
          icon={<IconSpectator />}
          label="Admin View"
          link={roleLinks.admin}
          selected={selectedRole === 'admin'}
          onSelect={() => { setSelectedRole(selectedRole === 'admin' ? null : 'admin'); setJoinError(''); }}
          onOpen={() => { setJoinError(''); setSpectatorError(''); setSpectatorPassword(''); setShowSpectatorModal(true); }}
        />
      </div>

      {joinError && (
        <p className="mt-8 text-red-500 text-sm text-center max-w-xs">{joinError}</p>
      )}

      {/* Spectator password modal */}
      {showSpectatorModal && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => setShowSpectatorModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-white border border-[#e8e0f5] rounded-2xl p-8">
              <div className="flex flex-col items-center mb-6">
                <IconSpectator />
                <p className="text-gray-900 font-semibold text-lg mt-4">Admin View</p>
                <p className="text-gray-500 text-sm mt-1 text-center">Enter the password to access admin view</p>
              </div>
              <form onSubmit={handleSpectatorSubmit} className="space-y-4">
                <input
                  type="password"
                  value={spectatorPassword}
                  onChange={(e) => setSpectatorPassword(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  className="w-full bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#8B2BE2] focus:ring-2 focus:ring-[#8B2BE2]/10 transition-all"
                />
                {spectatorError && (
                  <p className="text-red-500 text-sm text-center">{spectatorError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSpectatorModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e8e0f5] text-gray-500 text-sm font-semibold hover:text-white hover:border-[#555] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#8B2BE2] hover:bg-[#7B1BD2] text-white font-semibold text-sm transition-all shadow-lg shadow-[#8B2BE2]/20"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

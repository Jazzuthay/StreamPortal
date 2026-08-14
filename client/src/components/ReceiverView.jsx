import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC.js';
import socket from '../utils/socket.js';
import DebugOverlay from './DebugOverlay.jsx';
import RotationControl from './RotationControl.jsx';
import DeviceSelector from './DeviceSelector.jsx';

const FIT_MODES = [
  { key: 'contain', label: 'Fit',     desc: 'Black bars, whole frame visible' },
  { key: 'cover',   label: 'Fill',    desc: 'Crop edges to fill screen' },
  { key: 'fill',    label: 'Stretch', desc: 'Stretch to fill exactly' },
  { key: 'none',    label: 'Native',  desc: 'Original feed size' },
];

function ConnectionBadge({ state }) {
  const dot = { connected: 'bg-green-500', connecting: 'bg-yellow-500', new: 'bg-yellow-500', disconnected: 'bg-red-500', failed: 'bg-red-500', closed: 'bg-[#555]' };
  return (
    <span className="flex items-center gap-2 text-sm text-gray-500">
      <span className={`w-2 h-2 rounded-full ${dot[state] || 'bg-[#555]'}`} />
      {state}
    </span>
  );
}

const GearIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);
const BackIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
const SpeakerOnIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);
const SpeakerOffIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);

export default function ReceiverView({ roomId, onLeave }) {
  const remoteVideoRef  = useRef(null);
  const localPreviewRef = useRef(null);
  const containerRef    = useRef(null);
  const hideTimerRef    = useRef(null);

  const [localStream,        setLocalStream]        = useState(null);
  const [micMuted,           setMicMuted]           = useState(false);
  const [adminMutedMic,      setAdminMutedMic]      = useState(false);
  const [adminMutedSpeaker,  setAdminMutedSpeaker]  = useState(false);
  const [senderDisconnected, setSenderDisconnected] = useState(false);
  const [speakerMuted,       setSpeakerMuted]       = useState(false);
  const [displayRotation,    setDisplayRotation]    = useState(0);
  const [fitMode,            setFitMode]            = useState('cover');
  const [isFullscreen,       setIsFullscreen]       = useState(false);
  const [showControls,       setShowControls]       = useState(true);
  const [flipped,            setFlipped]            = useState(false);
  const [showSettings,       setShowSettings]       = useState(false);
  const [overlayMode,        setOverlayMode]        = useState('logo');

  // Acquire own camera so spectators can see the viewer's feed
  useEffect(() => {
    let stream = null;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    navigator.mediaDevices.getUserMedia({
      video: mobile
        ? { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    }).then((s) => { stream = s; setLocalStream(s); }).catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (localPreviewRef.current && localStream) {
      localPreviewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const { hasRemoteVideo, connectionState, iceGatheringState, setSpeakerMuted: setSpeakerMutedFn, setMicMuted: setMicMutedFn } = useWebRTC({
    role: 'receiver', roomId, localStream, remoteVideoRef,
  });

  useEffect(() => {
    if (hasRemoteVideo) setSenderDisconnected(false);
  }, [hasRemoteVideo]);

  useEffect(() => {
    const h = ({ role }) => { if (role === 'sender') setSenderDisconnected(true); };
    socket.on('peer-disconnected', h);
    return () => socket.off('peer-disconnected', h);
  }, []);

  useEffect(() => {
    const h = ({ mode }) => setOverlayMode(mode);
    socket.on('set-overlay', h);
    return () => socket.off('set-overlay', h);
  }, []);

  function handleSpeakerMute() {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    setSpeakerMutedFn(next);
  }

  function handleMicMute() {
    const next = !micMuted;
    setMicMuted(next);
    setMicMutedFn(next);
  }

  // Admin remote-mute listener
  useEffect(() => {
    function onAdminControl({ type, muted }) {
      if (type === 'mic') {
        setMicMuted(muted);
        setAdminMutedMic(muted);
        setMicMutedFn(muted);
      }
      if (type === 'speaker') {
        setSpeakerMuted(muted);
        setAdminMutedSpeaker(muted);
        setSpeakerMutedFn(muted);
      }
    }
    socket.on('admin-control', onAdminControl);
    return () => socket.off('admin-control', onAdminControl);
  }, [setMicMutedFn, setSpeakerMutedFn]);

  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) { setShowControls(true); clearTimeout(hideTimerRef.current); }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const revealControls = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (!showSettings) hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [showSettings]);

  useEffect(() => {
    if (showSettings) { clearTimeout(hideTimerRef.current); setShowControls(true); }
  }, [showSettings]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const [needsFullscreen, setNeedsFullscreen] = useState(true);

  const enterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); } catch { /* denied */ }
  }, []);
  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  }, []);

  useEffect(() => { if (isFullscreen) setNeedsFullscreen(false); }, [isFullscreen]);

  const videoStyle = {
    objectFit: fitMode,
    transform: `rotate(${displayRotation}deg) scaleX(${flipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
    width: '100%', height: '100%', display: 'block',
  };

  if (senderDisconnected && !hasRemoteVideo) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xl font-semibold text-gray-900 mb-2">Sender Disconnected</p>
        <p className="text-gray-500 text-sm">Waiting for sender to reconnect…</p>
      </div>
    </div>
  );

  const controlsVisible = !isFullscreen || showControls;

  return (
    <div className="min-h-screen bg-[#f8f5ff] flex flex-col items-center justify-center p-6">
      <div
        ref={containerRef}
        onMouseMove={() => { if (isFullscreen) revealControls(); }}
        onClick={() => { if (isFullscreen && !showSettings) revealControls(); }}
        className="relative bg-black overflow-hidden"
        style={isFullscreen
          ? { width: '100%', height: '100%' }
          : { width: '100%', maxWidth: '320px', aspectRatio: '9/16', borderRadius: '12px', border: '1px solid #e8e0f5' }
        }
      >
        {/* Always rendered so Agora play() has a DOM target */}
        <video ref={remoteVideoRef} autoPlay playsInline style={{ ...videoStyle, display: hasRemoteVideo ? 'block' : 'none' }} />

        {!hasRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#141414]">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Waiting for sender…</p>
          </div>
        )}

        {/* Own camera PiP (visible to spectators) */}
        {localStream && (
          <div className="absolute bottom-12 left-3 z-10 w-16 rounded-lg overflow-hidden border border-[#e8e0f5] shadow-lg" style={{ aspectRatio: '3/4' }}>
            <video ref={localPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
        )}

        {/* Back button — top-left corner */}
        {onLeave && (
          <button
            onClick={(e) => { e.stopPropagation(); onLeave(); }}
            style={{ transition: 'opacity 0.3s ease', opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
            className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white shadow-lg"
          >
            <BackIcon />
          </button>
        )}

        {/* Gear icon — top-right corner */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); }}
          style={{ transition: 'opacity 0.3s ease', opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
          className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            showSettings ? 'bg-[#7c3aed] text-white' : 'bg-black/60 hover:bg-black/80 text-white'
          }`}
        >
          <GearIcon />
        </button>

        {/* Logo overlay — top center (sender-controlled) */}
        {overlayMode === 'logo' && (
          <div className="absolute top-3 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <img src="/HOLOBOX-LOGO.png" alt="Holobox 911" className="h-16 object-contain drop-shadow-lg" />
          </div>
        )}

        {/* Full-screen overlay (sender-controlled) */}
        {overlayMode === 'fullscreen' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <img
              src="/HOLOBOX-OVERLAY.png"
              alt="Overlay"
              style={{ width: '95%', height: '95%', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Connection dot */}
        <div
          className="absolute bottom-3 left-3 z-10"
          style={{ transition: 'opacity 0.3s ease', opacity: controlsVisible ? 1 : 0 }}
        >
          <ConnectionBadge state={connectionState} />
        </div>

        {/* Tap-to-fullscreen prompt */}
        {needsFullscreen && !isFullscreen && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={enterFullscreen}
          >
            <svg width="48" height="48" fill="white" viewBox="0 0 24 24" opacity="0.9">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <p className="text-white font-semibold mt-3 text-base">Tap to enter fullscreen</p>
          </div>
        )}
      </div>

      {/* Settings — right-side overlay */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-40 w-72 bg-white border-l border-[#e8e0f5] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#e8e0f5]">
              <p className="text-gray-900 font-semibold">Settings</p>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-900 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Audio */}
              <div>
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Audio</p>
                <div className="space-y-2">
                  <button
                    onClick={handleSpeakerMute}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                      speakerMuted
                        ? 'bg-red-600 border-red-600 text-white hover:bg-red-500'
                        : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                    }`}
                  >
                    {speakerMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                    {speakerMuted ? 'Speaker Muted' : 'Mute Speaker'}
                  </button>
                  {adminMutedSpeaker && (
                    <p className="text-center text-xs text-red-400 font-semibold tracking-wide">Admin has muted your speaker</p>
                  )}
                  {localStream && (
                    <button
                      onClick={handleMicMute}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                        micMuted
                          ? 'bg-red-600 border-red-600 text-white hover:bg-red-500'
                          : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                      }`}
                    >
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                        {micMuted
                          ? <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                          : <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                        }
                      </svg>
                      {micMuted ? 'Mic Muted' : 'Mute Mic'}
                    </button>
                  )}
                  {adminMutedMic && (
                    <p className="text-center text-xs text-red-400 font-semibold tracking-wide">Admin has muted your mic</p>
                  )}
                </div>
              </div>

              {/* Feed Size + Flip */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Feed Size</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {FIT_MODES.map(({ key, label, desc }) => (
                    <button key={key} title={desc} onClick={() => setFitMode(key)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        fitMode === key
                          ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                          : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                      }`}
                    >{label}</button>
                  ))}
                </div>
                <button
                  onClick={() => setFlipped((f) => !f)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    flipped
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                      : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                  }`}
                >⇄ Mirror / Flip {flipped ? '(ON)' : '(OFF)'}</button>
              </div>

              {/* Display Rotation */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Display Rotation</p>
                <RotationControl currentRotation={displayRotation} onRotate={setDisplayRotation} />
              </div>

              {/* Audio Output device */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Audio Output</p>
                <DeviceSelector role="receiver" videoRef={remoteVideoRef} />
              </div>

              {/* Fullscreen */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <button
                  onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                  className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm9 0h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1zM1 10.5a.5.5 0 0 1 .5-.5H5v-3.5a.5.5 0 0 1 1 0V10.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5zm9 3a.5.5 0 0 1 .5-.5H14v-3.5a.5.5 0 0 1 1 0V14.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>
            </div>

            {onLeave && (
              <div className="p-5 border-t border-[#e8e0f5]">
                <button
                  onClick={onLeave}
                  className="w-full bg-transparent border border-red-600/50 hover:border-red-500 hover:bg-red-600/10 text-red-400 hover:text-red-300 font-semibold py-2.5 rounded-xl transition-all text-sm"
                >
                  ✕ Leave
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <DebugOverlay role="receiver" connectionState={connectionState} iceGatheringState={iceGatheringState} />
    </div>
  );
}

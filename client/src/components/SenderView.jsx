import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC.js';
import socket from '../utils/socket.js';
import DebugOverlay from './DebugOverlay.jsx';
import RotationControl from './RotationControl.jsx';
import DeviceSelector from './DeviceSelector.jsx';

function ConnectionBadge({ state }) {
  const colors = {
    connected: 'bg-green-500', connecting: 'bg-yellow-500', new: 'bg-yellow-500',
    disconnected: 'bg-red-500', failed: 'bg-red-500', closed: 'bg-[#888]',
  };
  return (
    <span className="flex items-center gap-2 text-sm text-gray-500">
      <span className={`w-2 h-2 rounded-full ${colors[state] || 'bg-[#888]'}`} />
      {state}
    </span>
  );
}

function useRecording(stream, roomId) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `recording-${roomId}-${Date.now()}.webm`; a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [stream, roomId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return { isRecording, timer: `${mm}:${ss}`, startRecording, stopRecording };
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
const MicOnIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
  </svg>
);
const MicOffIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

export default function SenderView({ roomId, onLeave }) {
  const [rawStream,       setRawStream]       = useState(null);
  const [mediaError,      setMediaError]      = useState('');
  const [micMuted,        setMicMuted]        = useState(false);
  const [adminMutedMic,   setAdminMutedMic]   = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewFlipped,  setPreviewFlipped]  = useState(false);
  const [overlayMode,     setOverlayMode]     = useState('logo');
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [needsFullscreen, setNeedsFullscreen] = useState(true);
  const localVideoRef  = useRef(null);
  const containerRef   = useRef(null);
  const selectedCamera = useRef(null);
  const selectedMic    = useRef(null);

  async function startCamera(cameraId, micId) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mobile
          ? { width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 }, ...(cameraId ? { deviceId: { exact: cameraId } } : {}) }
          : { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 }, ...(cameraId ? { deviceId: { exact: cameraId } } : {}) },
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return stream; });
    } catch (err) {
      setMediaError(`Camera error: ${err.message}`);
    }
  }

  useEffect(() => {
    startCamera(null, null);
    return () => setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
  }, []);

  useEffect(() => {
    if (localVideoRef.current && rawStream) localVideoRef.current.srcObject = rawStream;
  }, [rawStream]);

  const { connectionState, iceGatheringState, viewerCount, setMicMuted: setMicMutedFn } = useWebRTC({
    role: 'sender',
    roomId,
    localStream: rawStream,
  });

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
    }
    socket.on('admin-control', onAdminControl);
    return () => socket.off('admin-control', onAdminControl);
  }, [setMicMutedFn]);

  const { isRecording, timer, startRecording, stopRecording } = useRecording(rawStream, roomId);

  const enterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); } catch { /* denied */ }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => { if (isFullscreen) setNeedsFullscreen(false); }, [isFullscreen]);

  async function handleCameraChange(deviceId) {
    selectedCamera.current = deviceId;
    await startCamera(deviceId, selectedMic.current);
  }
  async function handleMicChange(deviceId) {
    selectedMic.current = deviceId;
    await startCamera(selectedCamera.current, deviceId);
  }

  const is90or270 = previewRotation === 90 || previewRotation === 270;
  const previewStyle = {
    position: 'absolute', top: '50%', left: '50%',
    width: is90or270 ? '177.8%' : '100%',
    height: is90or270 ? '56.25%' : '100%',
    objectFit: 'cover',
    transform: `translate(-50%, -50%) rotate(${previewRotation}deg) scaleX(${previewFlipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
  };

  if (mediaError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff]">
      <p className="text-red-400">{mediaError}</p>
    </div>
  );

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f8f5ff] flex flex-col items-center justify-center p-4">
      {/* Portrait video container */}
      <div className="relative" style={{ width: '100%', maxWidth: 'min(540px, calc(100vw - 2rem))', aspectRatio: '9/16' }}>
        <div className="w-full h-full bg-[#141414] border border-[#e8e0f5] rounded-xl overflow-hidden relative">
          <video ref={localVideoRef} autoPlay muted playsInline style={previewStyle} />
          {!rawStream && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              Starting camera…
            </div>
          )}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1 z-10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-mono">{timer}</span>
            </div>
          )}
        </div>

        {/* Back button — top-left corner */}
        {onLeave && (
          <button
            onClick={onLeave}
            className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white shadow-lg transition-colors"
          >
            <BackIcon />
          </button>
        )}

        {/* Gear icon — top-right corner */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            showSettings ? 'bg-[#7c3aed] text-white' : 'bg-black/60 hover:bg-black/80 text-white'
          }`}
        >
          <GearIcon />
        </button>
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center gap-4">
        <ConnectionBadge state={connectionState} />
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-[#7c3aed]" />
          {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
        </span>
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
              {/* Devices */}
              <div>
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Camera & Microphone</p>
                <DeviceSelector role="sender" onCameraChange={handleCameraChange} onMicChange={handleMicChange} />
                <button
                  onClick={handleMicMute}
                  className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                    micMuted
                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-500'
                      : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                  }`}
                >
                  {micMuted ? <MicOffIcon /> : <MicOnIcon />}
                  {micMuted ? 'Mic Muted' : 'Mute Mic'}
                </button>
                {adminMutedMic && (
                  <p className="mt-2 text-center text-xs text-red-400 font-semibold tracking-wide">Admin has muted your mic</p>
                )}
              </div>

              {/* Preview rotation (CSS display only — raw stream sent to viewers) */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-1">Preview Rotation</p>
                <p className="text-gray-400 text-xs mb-3">Display only — raw stream is sent to viewers</p>
                <RotationControl currentRotation={previewRotation} onRotate={setPreviewRotation} />
                <button
                  onClick={() => setPreviewFlipped((f) => !f)}
                  className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    previewFlipped
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                      : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                  }`}
                >
                  ⇄ Mirror / Flip {previewFlipped ? '(ON)' : '(OFF)'}
                </button>
              </div>

              {/* Viewer Overlay */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-1">Viewer Overlay</p>
                <p className="text-gray-400 text-xs mb-3">Controls what appears on the viewer's screen</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['none', 'Off'], ['logo', 'Logo'], ['fullscreen', 'Full Screen']].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setOverlayMode(mode);
                        socket.emit('set-overlay', { roomId, mode });
                      }}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        overlayMode === mode
                          ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                          : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#7c3aed] hover:text-gray-900'
                      }`}
                    >{label}</button>
                  ))}
                </div>
                {overlayMode !== 'none' && (
                  <p className="mt-2 text-[#7c3aed] text-xs font-semibold">
                    {overlayMode === 'logo' ? '✓ Logo showing on viewer' : '✓ Full screen overlay on viewer'}
                  </p>
                )}
              </div>

              {/* Recording */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-3">Recording</p>
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!rawStream}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Start Recording
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-gray-900 font-mono text-sm">{timer}</span>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="w-full bg-[#e8e0f5] hover:bg-[#d8d0f0] text-gray-900 font-semibold py-2 rounded-lg transition-colors text-sm"
                    >
                      Stop & Download
                    </button>
                  </div>
                )}
              </div>
            </div>

            {onLeave && (
              <div className="p-5 border-t border-[#e8e0f5]">
                <button
                  onClick={onLeave}
                  className="w-full bg-transparent border border-red-600/50 hover:border-red-500 hover:bg-red-600/10 text-red-400 hover:text-red-300 font-semibold py-2.5 rounded-xl transition-all text-sm"
                >
                  ✕ Stop Broadcasting
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tap-to-fullscreen prompt */}
      {needsFullscreen && !isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={enterFullscreen}
        >
          <svg width="48" height="48" fill="white" viewBox="0 0 24 24" opacity="0.9">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
          <p className="text-white font-semibold mt-3 text-base">Tap to enter fullscreen</p>
        </div>
      )}

      <DebugOverlay role="sender" connectionState={connectionState} iceGatheringState={iceGatheringState} />
    </div>
  );
}

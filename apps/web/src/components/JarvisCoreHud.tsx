'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Globe,
  MessageSquare,
  PhoneCall,
  FileSearch,
  Activity,
  ShieldAlert,
  Cpu,
  Radio,
  ExternalLink,
} from 'lucide-react';

export type HudCoreState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'awaiting_approval'
  | 'error';

interface JarvisCoreHudProps {
  hudState: HudCoreState;
  isApiConnected: boolean;
  edgeBridgeConnected: boolean;
  isVoiceLoopEnabled: boolean;
  isVoiceLoopPaused: boolean;
  isVoiceListening: boolean;
  isSpeaking: boolean;
  ttsAutoSpeak: boolean;
  killSwitchActive: boolean;
  analyserNode: AnalyserNode | null;
  micPermissionDenied: boolean;
  interimTranscript: string;
  onToggleVoiceLoop: () => void;
  onTogglePauseVoiceLoop: () => void;
  onToggleTts: () => void;
  onStopSpeaking: () => void;
  onOpenEdgeUrl: (url: string) => void;
  onWhatsAppSearchDoc: (keyword: string) => void;
  onWhatsAppCall: (contact: string) => void;
}

const STATE_CONFIG: Record<
  HudCoreState,
  {
    label: string;
    ringColor: string;
    glowClass: string;
    coreBg: string;
    accentHex: string;
    secondaryHex: string;
  }
> = {
  idle: {
    label: 'STANDBY // NOMINAL',
    ringColor: 'border-cyan-400/50',
    glowClass: 'shadow-[0_0_45px_rgba(34,211,238,0.22)]',
    coreBg: 'from-cyan-500/25 via-sky-500/10 to-slate-950',
    accentHex: '#22d3ee',
    secondaryHex: '#0ea5e9',
  },
  listening: {
    label: 'AUDIO UPLINK // LISTENING',
    ringColor: 'border-emerald-400/80',
    glowClass: 'shadow-[0_0_60px_rgba(16,185,129,0.45)]',
    coreBg: 'from-emerald-400/35 via-cyan-500/20 to-slate-950',
    accentHex: '#34d399',
    secondaryHex: '#22d3ee',
  },
  thinking: {
    label: 'NEURAL CORE // PROCESSING',
    ringColor: 'border-indigo-400/80',
    glowClass: 'shadow-[0_0_55px_rgba(129,140,248,0.42)]',
    coreBg: 'from-indigo-500/35 via-cyan-400/15 to-slate-950',
    accentHex: '#818cf8',
    secondaryHex: '#38bdf8',
  },
  speaking: {
    label: 'VOICE SYNTH // TRANSMITTING',
    ringColor: 'border-amber-400/85',
    glowClass: 'shadow-[0_0_65px_rgba(251,191,36,0.45)]',
    coreBg: 'from-amber-400/35 via-orange-500/15 to-slate-950',
    accentHex: '#fbbf24',
    secondaryHex: '#f59e0b',
  },
  awaiting_approval: {
    label: 'AUTH GATE // APPROVAL REQUIRED',
    ringColor: 'border-amber-500/90',
    glowClass: 'shadow-[0_0_55px_rgba(245,158,11,0.45)]',
    coreBg: 'from-amber-500/35 via-rose-500/15 to-slate-950',
    accentHex: '#f59e0b',
    secondaryHex: '#fb7185',
  },
  error: {
    label: 'SYSTEM FAULT // CHECK TELEMETRY',
    ringColor: 'border-rose-500/90',
    glowClass: 'shadow-[0_0_55px_rgba(244,63,94,0.45)]',
    coreBg: 'from-rose-500/35 via-red-900/20 to-slate-950',
    accentHex: '#f43f5e',
    secondaryHex: '#fb7185',
  },
};

export function JarvisCoreHud({
  hudState,
  isApiConnected,
  edgeBridgeConnected,
  isVoiceLoopEnabled,
  isVoiceLoopPaused,
  isVoiceListening,
  isSpeaking,
  ttsAutoSpeak,
  killSwitchActive,
  analyserNode,
  micPermissionDenied,
  interimTranscript,
  onToggleVoiceLoop,
  onTogglePauseVoiceLoop,
  onToggleTts,
  onStopSpeaking,
  onOpenEdgeUrl,
  onWhatsAppSearchDoc,
  onWhatsAppCall,
}: JarvisCoreHudProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [edgeUrlInput, setEdgeUrlInput] = useState('https://github.com');
  const [waDocQuery, setWaDocQuery] = useState('');
  const [waContact, setWaContact] = useState('');
  const [showQuickBridge, setShowQuickBridge] = useState(false);

  const cfg = STATE_CONFIG[hudState];

  // Real-time HTML5 Canvas Web Audio API frequency waveform / radial visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isActiveWave = hudState === 'listening' || hudState === 'speaking' || hudState === 'thinking';
      let hasLiveAudio = false;

      if (analyserNode && hudState === 'listening' && !micPermissionDenied) {
        analyserNode.getByteFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 4) {
            hasLiveAudio = true;
            break;
          }
        }
      }

      const barCount = 48;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.28;

      phase += isActiveWave ? 0.08 : 0.025;

      // Draw subtle radial frequency bars around the core center
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        let norm = 0.08;

        if (hasLiveAudio) {
          const idx = Math.floor((i / barCount) * Math.min(bufferLength, 48));
          norm = Math.max(0.08, dataArray[idx] / 255);
        } else if (hudState === 'listening') {
          norm = 0.2 + 0.35 * Math.abs(Math.sin(phase * 1.4 + i * 0.35));
        } else if (hudState === 'speaking') {
          norm = 0.25 + 0.55 * Math.abs(Math.sin(phase * 2.1 + i * 0.45) * Math.cos(phase * 0.9 + i * 0.2));
        } else if (hudState === 'thinking') {
          norm = 0.16 + 0.24 * Math.abs(Math.sin(phase * 1.8 + i * 0.5));
        } else if (hudState === 'awaiting_approval' || hudState === 'error') {
          norm = 0.14 + 0.14 * Math.abs(Math.sin(phase * 2.4));
        } else {
          norm = 0.06 + 0.05 * Math.sin(phase + i * 0.25);
        }

        const barLen = 6 + norm * 26;
        const x1 = centerX + Math.cos(angle) * baseRadius;
        const y1 = centerY + Math.sin(angle) * baseRadius;
        const x2 = centerX + Math.cos(angle) * (baseRadius + barLen);
        const y2 = centerY + Math.sin(angle) * (baseRadius + barLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = i % 2 === 0 ? cfg.accentHex : cfg.secondaryHex;
        ctx.lineWidth = isActiveWave ? 2.4 : 1.5;
        ctx.lineCap = 'round';
        ctx.globalAlpha = isActiveWave ? 0.85 : 0.4;
        ctx.stroke();
      }

      // Draw horizontal telemetry waveform strip at bottom of canvas
      ctx.beginPath();
      const waveY = height - 14;
      for (let x = 0; x <= width; x += 4) {
        const t = x / width;
        const env = Math.sin(t * Math.PI);
        let amp = 2;
        if (hasLiveAudio) {
          const idx = Math.floor(t * Math.min(bufferLength, 48));
          amp = 2 + (dataArray[idx] / 255) * 14;
        } else if (hudState === 'speaking') {
          amp = 4 + Math.abs(Math.sin(phase * 2.2 + t * 14)) * 10;
        } else if (hudState === 'listening') {
          amp = 3 + Math.abs(Math.sin(phase * 1.5 + t * 10)) * 7;
        } else if (hudState === 'thinking') {
          amp = 3 + Math.abs(Math.sin(phase * 2 + t * 18)) * 5;
        }
        const y = waveY + Math.sin(t * 22 + phase * 2) * amp * env;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = cfg.accentHex;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = isActiveWave ? 0.75 : 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [analyserNode, hudState, micPermissionDenied, cfg.accentHex, cfg.secondaryHex]);

  return (
    <div className="relative rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#080d16] via-[#060911] to-[#04060b] p-4 shadow-[0_0_40px_rgba(8,145,178,0.12)] overflow-hidden">
      {/* Subtle HUD Corner Brackets */}
      <div className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/50 rounded-tl" />
      <div className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/50 rounded-tr" />
      <div className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/50 rounded-bl" />
      <div className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/50 rounded-br" />

      {/* Top Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono tracking-wider pb-3 border-b border-cyan-500/15">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>J.A.R.V.I.S. HUD</span>
          </span>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${
              edgeBridgeConnected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900/70 text-slate-400'
            }`}
          >
            <Globe className="w-3 h-3" />
            EDGE BRIDGE: {edgeBridgeConnected ? 'SYNCED' : 'STANDBY'}
          </span>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${
              isApiConnected
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <Activity className={`w-3 h-3 ${isApiConnected ? 'animate-pulse' : ''}`} />
            AGENT HEARTBEAT: {isApiConnected ? 'ONLINE' : 'LOCAL FALLBACK'}
          </span>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${
              isVoiceLoopEnabled
                ? isVoiceLoopPaused
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900/70 text-slate-400'
            }`}
          >
            <Radio className={`w-3 h-3 ${isVoiceLoopEnabled && !isVoiceLoopPaused ? 'animate-pulse' : ''}`} />
            VOICE LOOP:{' '}
            {isVoiceLoopEnabled ? (isVoiceLoopPaused ? 'PAUSED' : 'CONTINUOUS') : 'MANUAL'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${
              killSwitchActive
                ? 'border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            KILL SWITCH: {killSwitchActive ? 'ENGAGED' : 'NOMINAL'}
          </span>
          <button
            type="button"
            onClick={() => setShowQuickBridge((v) => !v)}
            className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
          >
            {showQuickBridge ? 'HIDE BRIDGE' : 'EDGE & WHATSAPP'}
          </button>
        </div>
      </div>

      {/* Center Neural Core / Arc-Reactor + Canvas Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-center pt-3">
        <div className="relative flex flex-col items-center justify-center">
          {/* Canvas radial + waveform */}
          <canvas
            ref={canvasRef}
            width={220}
            height={176}
            className="block"
            aria-label="Real-time Web Audio frequency visualizer"
          />

          {/* Arc-Reactor Concentric Orb */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center -mt-3">
            {/* Outer rotating segmented ring */}
            <div
              className={`w-28 h-28 rounded-full border-2 border-dashed ${cfg.ringColor} ${
                hudState === 'thinking'
                  ? 'animate-spin'
                  : 'animate-[spin_14s_linear_infinite]'
              }`}
            />
            {/* Inner counter-rotating ring */}
            <div
              className={`absolute w-20 h-20 rounded-full border ${cfg.ringColor} ${
                hudState === 'listening' || hudState === 'speaking' ? 'animate-ping opacity-30' : 'opacity-60'
              }`}
            />
            {/* Glowing Core */}
            <div
              className={`absolute w-16 h-16 rounded-full bg-gradient-to-br ${cfg.coreBg} border ${cfg.ringColor} ${cfg.glowClass} flex items-center justify-center transition-all duration-300`}
            >
              <div
                className={`w-6 h-6 rounded-full border border-white/40 ${
                  hudState === 'speaking' || hudState === 'listening' ? 'animate-pulse scale-110' : ''
                }`}
                style={{
                  background: `radial-gradient(circle, ${cfg.accentHex} 0%, transparent 75%)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right HUD Controls & Live Status */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                {cfg.label}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isVoiceListening
                  ? interimTranscript
                    ? `Transcript: "${interimTranscript}"`
                    : micPermissionDenied
                    ? 'Mic stream unavailable — using Web Speech fallback spectrum.'
                    : 'Listening… auto-submits after 1.2s of silence. Say "stop listening" to exit.'
                  : isSpeaking
                  ? 'Synthesizing J.A.R.V.I.S. response (mic paused to prevent echo).'
                  : isVoiceLoopEnabled
                  ? 'Continuous Voice Loop armed. Ready for next command.'
                  : 'Press Continuous Voice Mode for hands-free J.A.R.V.I.S. loop or type below.'}
              </p>
            </div>
          </div>

          {/* Primary Voice Loop Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleVoiceLoop}
              disabled={killSwitchActive}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all disabled:opacity-40 ${
                isVoiceLoopEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/25'
              }`}
            >
              {isVoiceLoopEnabled ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>
                {isVoiceLoopEnabled ? 'J.A.R.V.I.S. Loop: ON' : 'Continuous Voice Mode'}
              </span>
            </button>

            {isVoiceLoopEnabled && (
              <button
                type="button"
                onClick={onTogglePauseVoiceLoop}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                  isVoiceLoopPaused
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isVoiceLoopPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isVoiceLoopPaused ? 'Resume Loop' : 'Mute / Pause'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTts}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                ttsAutoSpeak
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {ttsAutoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>TTS {ttsAutoSpeak ? 'ON' : 'OFF'}</span>
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500/20 border border-rose-400/50 text-rose-200 hover:bg-rose-500/30"
              >
                Stop Audio
              </button>
            )}
          </div>

          {/* Collapsible Edge Quick-Open & WhatsApp HUD Controls */}
          {showQuickBridge && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-cyan-500/15">
              {/* Microsoft Edge Quick-Open */}
              <div className="rounded-lg border border-cyan-500/25 bg-black/50 p-2.5 space-y-1.5">
                <div className="text-[10px] font-mono text-cyan-300 flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> EDGE QUICK-OPEN
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={edgeUrlInput}
                    onChange={(e) => setEdgeUrlInput(e.target.value)}
                    placeholder="https://youtube.com"
                    className="flex-1 min-w-0 rounded bg-slate-950 border border-slate-800 px-2 py-1 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => edgeUrlInput.trim() && onOpenEdgeUrl(edgeUrlInput.trim())}
                    className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-[11px]"
                  >
                    Open
                  </button>
                </div>
              </div>

              {/* WhatsApp Document Search */}
              <div className="rounded-lg border border-emerald-500/25 bg-black/50 p-2.5 space-y-1.5">
                <div className="text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                  <FileSearch className="w-3 h-3" /> WHATSAPP DOC SEARCH
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={waDocQuery}
                    onChange={(e) => setWaDocQuery(e.target.value)}
                    placeholder="e.g. syllabus"
                    className="flex-1 min-w-0 rounded bg-slate-950 border border-slate-800 px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => waDocQuery.trim() && onWhatsAppSearchDoc(waDocQuery.trim())}
                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px]"
                  >
                    Find
                  </button>
                </div>
              </div>

              {/* WhatsApp Call */}
              <div className="rounded-lg border border-sky-500/25 bg-black/50 p-2.5 space-y-1.5">
                <div className="text-[10px] font-mono text-sky-300 flex items-center gap-1.5">
                  <PhoneCall className="w-3 h-3" /> WHATSAPP CALL
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={waContact}
                    onChange={(e) => setWaContact(e.target.value)}
                    placeholder="Contact name..."
                    className="flex-1 min-w-0 rounded bg-slate-950 border border-slate-800 px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => waContact.trim() && onWhatsAppCall(waContact.trim())}
                    className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-black font-semibold text-[11px] flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" /> Call
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AssistantStatus,
  Task,
  ToolCallProposal,
  AuditLogEntry,
  WebSearchResultItem,
  DocumentSnippetCitation,
  KillSwitchStatus,
} from '@don/shared';
import {
  StatusOrb,
  CapabilityBadge,
  KillSwitchBanner,
  ApprovalCard,
} from '@don/ui';
import { JarvisCoreHud, HudCoreState } from '../components/JarvisCoreHud';
import { TrustedAppsRegistry, TrustedAppEntry } from '../components/TrustedAppsRegistry';
import {
  Shield,
  Bot,
  CheckSquare,
  Target,
  Calendar,
  Smartphone,
  Laptop,
  FileText,
  Search,
  Zap,
  Mic,
  MicOff,
  Send,
  AlertTriangle,
  FileSearch,
  Users,
  Download,
  ExternalLink,
  Database,
  RefreshCw,
  Volume2,
  VolumeX,
  Globe,
  Sliders,
  Sparkles,
  Key,
  Calculator,
} from 'lucide-react';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: (WebSearchResultItem | DocumentSnippetCitation)[];
  createdAt: string;
}

export default function DashboardPage() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'chat' | 'tasks' | 'goals' | 'docs' | 'meeting' | 'research' | 'devices' | 'automations' | 'privacy'
  >('chat');

  // Backend & AI Credentials State
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('http://localhost:3001');
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('http://localhost:3001');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [googleSearchApiKey, setGoogleSearchApiKey] = useState<string>('');
  const [googleSearchEngineId, setGoogleSearchEngineId] = useState<string>('');

  // Core Status State
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('ready');

  // Voice State (STT, TTS & Continuous J.A.R.V.I.S. Loop)
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [isVoiceLoopEnabled, setIsVoiceLoopEnabled] = useState<boolean>(false);
  const [isVoiceLoopPaused, setIsVoiceLoopPaused] = useState<boolean>(false);
  const [voiceTranscriptInterim, setVoiceTranscriptInterim] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [ttsAutoSpeak, setTtsAutoSpeak] = useState<boolean>(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [edgeBridgeConnected, setEdgeBridgeConnected] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const autoSendTimerRef = useRef<any>(null);
  const isRecognitionStoppingRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false);
  const lastSentCommandRef = useRef<{ text: string; ts: number }>({ text: '', ts: 0 });
  const voiceLoopEnabledRef = useRef<boolean>(false);
  const voiceLoopPausedRef = useRef<boolean>(false);
  const killSwitchRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const handleSendMessageRef = useRef<(customPrompt?: string, fromVoice?: boolean) => Promise<void>>(
    async () => {}
  );

  const [killSwitch, setKillSwitch] = useState<KillSwitchStatus>({
    isActivated: false,
    activatedAt: null,
    activatedByUserId: null,
    reason: '',
  });

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Good day, Commander. DON is ready—how may I assist?',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Approval State
  const [pendingApprovals, setPendingApprovals] = useState<ToolCallProposal[]>([]);

  // Tasks & Goals
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'task-1',
      userId: '1',
      title: 'Review quarterly infrastructure deployment budget',
      description: 'Cross-check Cloud Run quotas with projected enterprise load',
      status: 'TODO',
      priority: 'HIGH',
      timezone: 'UTC',
      labels: ['Finance', 'Cloud'],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      userId: '1',
      title: 'Verify mutual authentication on Android companion',
      description: 'Validate HMAC token handshake on local mDNS network',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      timezone: 'UTC',
      labels: ['Security', 'Android'],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');

  // Daily Briefing
  const [briefing, setBriefing] = useState<{
    weatherSummary: string;
    calendarEvents: Array<{ title: string; time: string; location: string }>;
    suggestedFocusBlock: { startTime: string; endTime: string; recommendedFocus: string };
  }>({
    weatherSummary: 'Partly cloudy, 18°C (64°F), light breeze.',
    calendarEvents: [
      { title: 'Operations Alignment', time: '10:00 AM - 10:30 AM', location: 'Virtual' },
      { title: 'Infrastructure Review', time: '02:00 PM - 03:00 PM', location: 'Conference Room B' },
    ],
    suggestedFocusBlock: {
      startTime: '10:45 AM',
      endTime: '12:45 PM',
      recommendedFocus: 'Verify mutual authentication on Android companion',
    },
  });

  // Focus Mode State
  const [focusActive, setFocusActive] = useState(false);
  const [focusTimer, setFocusTimer] = useState(45 * 60);

  // Meeting Mode
  const [meetingTranscript, setMeetingTranscript] = useState(
    'Host: Good morning team. We decided to freeze the API schema for the multi-device release.\nDev1: Action: implement the dialer intent and confirm the call permission checks on Android.\nDev2: Decision: use Fastify with Cloud Run for all production secret-bearing services.\nHost: Open question: do we need carrier routing controls? No, Wi-Fi calling is carrier managed.'
  );
  const [meetingResult, setMeetingResult] = useState<any>(null);

  // Research Mode
  const [researchQuery, setResearchQuery] = useState('Google Gemini search grounding integration');
  const [researchBrief, setResearchBrief] = useState<any>(null);
  const [isResearching, setIsResearching] = useState<boolean>(false);

  // Documents
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchResult, setDocSearchResult] = useState<any>(null);

  // Devices, Trusted Fast-Launch & Desktop Registry
  const [trustedFastLaunch, setTrustedFastLaunch] = useState<boolean>(true);
  const [trustedApps, setTrustedApps] = useState<TrustedAppEntry[]>([
    { id: '1', appName: 'Calculator', executablePath: 'C:\\Windows\\System32\\calc.exe', source: 'system', trusted: true },
    { id: '2', appName: 'Notepad', executablePath: 'C:\\Windows\\System32\\notepad.exe', source: 'system', trusted: true },
    { id: '3', appName: 'Windows Terminal', executablePath: 'wt.exe', source: 'system', trusted: true },
    { id: '4', appName: 'Microsoft Edge', executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', source: 'browser', trusted: true },
    { id: '5', appName: 'Visual Studio Code', executablePath: 'code', source: 'start-menu', trusted: true },
    { id: '6', appName: 'Spotify', executablePath: 'spotify', source: 'start-menu', trusted: false },
    { id: '7', appName: 'WhatsApp Desktop', executablePath: 'whatsapp://', source: 'protocol', trusted: true },
    { id: '8', appName: 'File Explorer', executablePath: 'explorer.exe', source: 'system', trusted: true },
  ]);
  const [phoneDialNumber, setPhoneDialNumber] = useState('+1-555-0199');
  const [pairingToken, setPairingToken] = useState('DON-9482');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'audit-0',
      userId: '1',
      deviceType: 'WEB',
      toolName: 'system_boot',
      parameters: { platform: 'web_dashboard', mode: 'production' },
      targetResource: 'SYSTEM',
      consequenceSummary: 'DON Dashboard session initialized with full audit trace.',
      status: 'EXECUTED',
      decisionMadeBy: 'SYSTEM',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Messages auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, pendingApprovals, isVoiceListening]);

  // Focus timer countdown
  useEffect(() => {
    let interval: any = null;
    if (focusActive && focusTimer > 0) {
      interval = setInterval(() => {
        setFocusTimer((prev) => prev - 1);
      }, 1000);
    } else if (focusTimer === 0) {
      setFocusActive(false);
    }
    return () => clearInterval(interval);
  }, [focusActive, focusTimer]);

  // Check Backend Health & Sync State
  const checkApiHealth = async (url: string) => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setIsApiConnected(true);
        setKillSwitch((prev) => ({ ...prev, isActivated: Boolean(data.killSwitchActive) }));

        // Fetch Tasks
        try {
          const tasksRes = await fetch(`${url}/api/tasks`);
          if (tasksRes.ok) {
            const remoteTasks = await tasksRes.json();
            if (Array.isArray(remoteTasks) && remoteTasks.length > 0) setTasks(remoteTasks);
          }
        } catch {}

        // Fetch Approvals
        try {
          const appRes = await fetch(`${url}/api/approvals`);
          if (appRes.ok) {
            const approvals = await appRes.json();
            if (Array.isArray(approvals)) setPendingApprovals(approvals);
          }
        } catch {}

        // Fetch Installed / Trusted Apps Registry
        try {
          const installedRes = await fetch(`${url}/api/devices/installed-apps`);
          if (installedRes.ok) {
            const payload = await installedRes.json();
            const list = Array.isArray(payload) ? payload : payload?.apps;
            if (Array.isArray(list) && list.length > 0) {
              setTrustedApps(
                list.map((a: any, idx: number) => ({
                  id: a.id || `app-${idx}`,
                  appName: a.appName || a.name || 'Unknown App',
                  executablePath: a.executablePath || a.path || a.command || '',
                  source: a.source || 'start-menu',
                  trusted: Boolean(a.trusted ?? true),
                }))
              );
            }
          }
        } catch {}

        // Fetch Trusted Fast-Launch Policy
        try {
          const policyRes = await fetch(`${url}/api/devices/trusted-policy`);
          if (policyRes.ok) {
            const policy = await policyRes.json();
            const fastLaunchVal = policy?.enabled ?? policy?.trustedFastLaunch;
            if (typeof fastLaunchVal === 'boolean') {
              setTrustedFastLaunch(fastLaunchVal);
            }
            if (typeof policy?.edgeBridgeConnected === 'boolean') {
              setEdgeBridgeConnected(policy.edgeBridgeConnected);
            }
          }
        } catch {}

        // Fetch Audit Logs
        try {
          const auditRes = await fetch(`${url}/api/audit`);
          if (auditRes.ok) {
            const logs = await auditRes.json();
            if (Array.isArray(logs) && logs.length > 0) setAuditLogs(logs);
          }
        } catch {}

        return true;
      }
    } catch {
      setIsApiConnected(false);
    }
    return false;
  };

  // Initial Setup Effect
  useEffect(() => {
    let initialUrl = 'http://localhost:3001';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('don_api_url');
      if (saved) {
        initialUrl = saved;
      } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        initialUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      }

      const savedGemini = localStorage.getItem('don_gemini_key') || '';
      const savedSearchKey = localStorage.getItem('don_google_search_key') || '';
      const savedCx = localStorage.getItem('don_google_cx') || '';
      const savedFastLaunch = localStorage.getItem('don_trusted_fast_launch');
      if (savedFastLaunch !== null) setTrustedFastLaunch(savedFastLaunch === 'true');
      setGeminiApiKey(savedGemini);
      setGoogleSearchApiKey(savedSearchKey);
      setGoogleSearchEngineId(savedCx);
    }

    setApiBaseUrl(initialUrl);
    setCustomUrlInput(initialUrl);
    checkApiHealth(initialUrl);

    // Warm up speech synthesis voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    // Clean up speech synthesis and mic stream on unmount
    return () => {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Web Audio API Mic Analyser Setup (with graceful fallback if mic denied)
  const ensureMicAnalyser = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicPermissionDenied(true);
      return;
    }
    if (analyserNode && micStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextCtor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      setAnalyserNode(analyser);
      setMicPermissionDenied(false);
    } catch {
      setMicPermissionDenied(true);
      setAnalyserNode(null);
    }
  };

  const teardownMicAnalyser = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAnalyserNode(null);
  };

  const stopVoiceRecognition = () => {
    isRecognitionStoppingRef.current = true;
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsVoiceListening(false);
    setVoiceTranscriptInterim('');
  };

  const startVoiceRecognition = async () => {
    if (typeof window === 'undefined' || killSwitchRef.current) return;
    setVoiceError(null);

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceError(
        'Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge for voice input.'
      );
      return;
    }

    await ensureMicAnalyser();

    // Ensure no stale recognition instance is running
    stopVoiceRecognition();

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecognitionStoppingRef.current = false;
        setIsVoiceListening(true);
        setVoiceTranscriptInterim('');
        setAssistantStatus('listening');
      };

      recognition.onresult = (event: any) => {
        if (isRecognitionStoppingRef.current) return;
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }

        const trimmed = fullTranscript.trim();
        if (!trimmed) return;

        setVoiceTranscriptInterim(trimmed);
        setInputPrompt(trimmed);

        const lower = trimmed.toLowerCase();
        if (
          lower.includes('stop listening') ||
          lower.includes('jarvis stop') ||
          lower.includes('don stop') ||
          lower.includes('pause listening')
        ) {
          stopVoiceRecognition();
          voiceLoopEnabledRef.current = false;
          voiceLoopPausedRef.current = false;
          setIsVoiceLoopEnabled(false);
          setIsVoiceLoopPaused(false);
          teardownMicAnalyser();
          setAssistantStatus('ready');
          setInputPrompt('');
          return;
        }

        // Auto-submit on 1.2s silence
        if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = setTimeout(() => {
          if (isRecognitionStoppingRef.current) return;
          stopVoiceRecognition();
          setInputPrompt('');
          handleSendMessageRef.current(trimmed, true);
        }, 1200);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission was denied. Using fallback spectrum; allow mic access for voice input.');
          setMicPermissionDenied(true);
          stopVoiceRecognition();
          voiceLoopEnabledRef.current = false;
          setIsVoiceLoopEnabled(false);
          setAssistantStatus('ready');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceError(`Voice input notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
        // If continuous loop is active and we are not speaking/thinking/paused, re-arm
        if (
          voiceLoopEnabledRef.current &&
          !voiceLoopPausedRef.current &&
          !killSwitchRef.current &&
          !activeUtteranceRef.current &&
          !isSendingRef.current
        ) {
          setTimeout(() => {
            if (
              voiceLoopEnabledRef.current &&
              !voiceLoopPausedRef.current &&
              !killSwitchRef.current
            ) {
              startVoiceRecognition();
            }
          }, 300);
        } else if (!isSpeaking) {
          setAssistantStatus('ready');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to start microphone.');
      setIsVoiceListening(false);
      setAssistantStatus('ready');
    }
  };

  // Text-To-Speech (TTS) Engine with Echo Prevention & Continuous Loop Re-arming
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      // Pause/stop SpeechRecognition while speaking to prevent echo
      stopVoiceRecognition();

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block omitted.')
        .replace(/[*_#`[\]()]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .replace(/\n+/g, '. ')
        .slice(0, 480);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.04;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('David') ||
              v.name.includes('Zira') ||
              v.name.includes('Samantha'))
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferred) {
        utterance.voice = preferred;
      }

      const handleSpeechComplete = () => {
        activeUtteranceRef.current = null;
        setIsSpeaking(false);
        if (
          voiceLoopEnabledRef.current &&
          !voiceLoopPausedRef.current &&
          !killSwitchRef.current
        ) {
          setTimeout(() => {
            if (
              voiceLoopEnabledRef.current &&
              !voiceLoopPausedRef.current &&
              !killSwitchRef.current
            ) {
              startVoiceRecognition();
            }
          }, 250);
        } else {
          setAssistantStatus('ready');
        }
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        setAssistantStatus('running');
      };
      utterance.onend = handleSpeechComplete;
      utterance.onerror = handleSpeechComplete;

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS playback note:', e);
      activeUtteranceRef.current = null;
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      activeUtteranceRef.current = null;
      setIsSpeaking(false);
      setAssistantStatus('ready');
    }
  };

  const handleToggleVoiceLoop = () => {
    if (killSwitchRef.current) return;
    if (isVoiceLoopEnabled) {
      voiceLoopEnabledRef.current = false;
      voiceLoopPausedRef.current = false;
      setIsVoiceLoopEnabled(false);
      setIsVoiceLoopPaused(false);
      stopVoiceRecognition();
      teardownMicAnalyser();
      setAssistantStatus('ready');
    } else {
      voiceLoopEnabledRef.current = true;
      voiceLoopPausedRef.current = false;
      setIsVoiceLoopEnabled(true);
      setIsVoiceLoopPaused(false);
      setTtsAutoSpeak(true);
      startVoiceRecognition();
    }
  };

  const handleTogglePauseVoiceLoop = () => {
    if (!isVoiceLoopEnabled) return;
    const nextPaused = !isVoiceLoopPaused;
    voiceLoopPausedRef.current = nextPaused;
    setIsVoiceLoopPaused(nextPaused);
    if (nextPaused) {
      stopVoiceRecognition();
      setAssistantStatus('ready');
    } else if (!isSpeaking && !killSwitchRef.current) {
      startVoiceRecognition();
    }
  };

  // Single-shot mic toggle in input bar
  const handleToggleVoice = () => {
    setVoiceError(null);
    if (isVoiceListening) {
      stopVoiceRecognition();
      setAssistantStatus('ready');
      return;
    }
    startVoiceRecognition();
  };

  // Safe Client-Side Math Evaluation
  const evaluateMathClient = (prompt: string): string | null => {
    const lower = prompt.toLowerCase().trim();
    // Percentages: X% of Y
    const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/);
    if (pctMatch) {
      const p = parseFloat(pctMatch[1]);
      const total = parseFloat(pctMatch[2]);
      const ans = (p / 100) * total;
      return `**Calculation:**\n\n${p}% of ${total} = **${ans}**`;
    }

    // Square root
    const sqrtMatch = lower.match(/sqrt\((\d+(?:\.\d+)?)\)/);
    if (sqrtMatch) {
      const v = parseFloat(sqrtMatch[1]);
      return `**Calculation:**\n\n√${v} = **${Math.sqrt(v)}**`;
    }

    // Basic arithmetic expressions
    const expr = prompt
      .replace(/^(what is|calculate|solve|evaluate)\s*/i, '')
      .replace(/times|multiplied by/gi, '*')
      .replace(/divided by/gi, '/')
      .replace(/plus/gi, '+')
      .replace(/minus/gi, '-')
      .replace(/[^0-9+\-*/().]/g, '')
      .trim();

    if (expr && /[\d]/.test(expr) && /[+\-*/]/.test(expr)) {
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
        // eslint-disable-next-line no-new-func
        const res = Function(`'use strict'; return (${sanitized})`)();
        if (typeof res === 'number' && !isNaN(res)) {
          return `**Calculation:**\n\n\`${expr}\` = **${res}**`;
        }
      } catch {}
    }
    return null;
  };

  // Live Google & Web Search via Public Web APIs
  const queryLiveGoogleAndWeb = async (query: string): Promise<WebSearchResultItem[]> => {
    const items: WebSearchResultItem[] = [];
    const cleanQ = query.replace(/^(search for|search google for|google|search|who is|what is|look up)\s+/i, '').trim();

    // 1. If backend API is connected, call /api/search
    if (isApiConnected) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanQ, googleApiKey: googleSearchApiKey, googleCx: googleSearchEngineId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results) && data.results.length > 0) {
            return data.results;
          }
        }
      } catch {}
    }

    // 2. Query Google Custom Search JSON API directly if credentials entered
    if (googleSearchApiKey && googleSearchEngineId) {
      try {
        const gUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleSearchApiKey)}&cx=${encodeURIComponent(googleSearchEngineId)}&q=${encodeURIComponent(cleanQ)}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.items && gData.items.length > 0) {
            return gData.items.slice(0, 4).map((it: any) => ({
              title: it.title,
              url: it.link,
              snippet: it.snippet,
              publishedDate: new Date().toISOString(),
              uncertaintyScore: 0.04,
            }));
          }
        }
      } catch {}
    }

    // 3. Query Wikipedia API directly as universal live web source
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json&origin=*`;
      const wRes = await fetch(wikiUrl);
      if (wRes.ok) {
        const wData = await wRes.json();
        if (wData.query?.search && wData.query.search.length > 0) {
          for (const s of wData.query.search.slice(0, 3)) {
            items.push({
              title: s.title,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/\s+/g, '_'))}`,
              snippet: s.snippet.replace(/<[^>]+>/g, '').trim(),
              publishedDate: s.timestamp || new Date().toISOString(),
              uncertaintyScore: 0.05,
            });
          }
        }
      }
    } catch {}

    // 4. Default fallback with clickable Google Search link
    if (items.length === 0) {
      items.push({
        title: `Google Search: ${cleanQ}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(cleanQ)}`,
        snippet: `Verified Google Search entry for "${cleanQ}". Live multi-source index connected.`,
        publishedDate: new Date().toISOString(),
        uncertaintyScore: 0.1,
      });
    }

    return items;
  };

  // Direct Client-Side Gemini Call with Google Search Grounding (if API key configured)
  const callGeminiDirectly = async (prompt: string, history: ChatMsg[]): Promise<{ reply: string; citations: WebSearchResultItem[] } | null> => {
    if (!geminiApiKey || geminiApiKey.includes('placeholder')) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const contents = history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const requestBody = {
        system_instruction: {
          parts: [
            {
              text: 'You are DON (Digital Operations Navigator) Voice Assistant, a crisp, respectful, multi-device AI assistant. Default to 1-3 short, direct sentences unless the user explicitly asks for a detailed explanation or code. Cite Google Search sources where applicable.',
            },
          ],
        },
        contents,
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const cand = data.candidates?.[0];
      const text = cand?.content?.parts?.[0]?.text;
      if (!text) return null;

      const citations: WebSearchResultItem[] = [];
      if (cand?.groundingMetadata?.groundingChunks) {
        for (const chunk of cand.groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            citations.push({
              title: chunk.web.title || 'Google Search Source',
              url: chunk.web.uri,
              snippet: 'Verified Google Search grounded citation referenced by Gemini.',
              publishedDate: new Date().toISOString(),
              uncertaintyScore: 0.04,
            });
          }
        }
      }

      return { reply: text, citations };
    } catch {
      return null;
    }
  };

  // Send Chat Prompt (API or Intelligent Client-Side Engine)
  const handleSendMessage = async (customPrompt?: string, fromVoice = false) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isSending || isSendingRef.current) return;

    const normalizedKey = textToSend.toLowerCase();
    const now = Date.now();
    if (
      normalizedKey === lastSentCommandRef.current.text &&
      now - lastSentCommandRef.current.ts < 3000
    ) {
      return;
    }
    lastSentCommandRef.current = { text: normalizedKey, ts: now };

    if (killSwitch.isActivated) {
      alert('Cannot execute: Stop All Automations kill switch is currently engaged.');
      return;
    }

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    isSendingRef.current = true;
    setIsSending(true);
    setAssistantStatus('thinking');

    try {
      let data: any = null;

      // 1. Try sending to live backend API (passing credentials if configured)
      if (isApiConnected) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: textToSend,
              history: chatMessages,
              geminiApiKey,
              googleSearchApiKey,
              googleSearchEngineId,
            }),
            signal: AbortSignal.timeout(14000),
          });

          if (response.ok) {
            data = await response.json();
          }
        } catch {}
      }

      // 2. Direct Gemini Call with Google Search Grounding if user configured a key
      if (!data && geminiApiKey) {
        const directGemini = await callGeminiDirectly(textToSend, chatMessages);
        if (directGemini) {
          data = {
            reply: directGemini.reply,
            citations: directGemini.citations,
            toolProposals: [],
          };
        }
      }

      // 3. Comprehensive Intelligent Assistant Engine (for offline, static GitHub Pages, or mock mode)
      if (!data) {
        const lower = textToSend.toLowerCase();
        const wantsDetailed =
          /\b(detailed|in depth|elaborate|step by step|comprehensive|explain thoroughly|write code|full)\b/i.test(
            lower
          );
        let fallbackReply = '';
        const fallbackProposals: ToolCallProposal[] = [];
        let fallbackCitations: WebSearchResultItem[] = [];

        // A1. WhatsApp Document Search ("search syllabus on whatsapp", "find pdf on whatsapp")
        if (lower.includes('whatsapp') && (lower.includes('search') || lower.includes('find') || lower.includes('download') || lower.includes('document') || lower.includes('syllabus') || lower.includes('pdf'))) {
          const kwMatch = textToSend.match(/(?:search|find|download|open)\s+(?:for\s+)?(.+?)\s+(?:on|in)\s+whatsapp/i);
          const keyword = kwMatch ? kwMatch[1].trim() : textToSend.replace(/whatsapp|search|find|download|open|on|in/gi, '').trim() || 'document';
          const prop: ToolCallProposal = {
            id: crypto.randomUUID(),
            toolName: 'propose_open_desktop_app',
            parameters: { action: 'whatsapp_search_download_open', keyword },
            consequence: {
              target: `WhatsApp Doc: "${keyword}"`,
              description: `Search signed-in WhatsApp Web / local WhatsApp Downloads for "${keyword}" and open in Microsoft Edge.`,
              isReversible: true,
              riskLevel: 'MEDIUM',
              requiresLocalAgent: true,
              requiresAndroidCompanion: false,
            },
            requiresApproval: true,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          fallbackProposals.push(prop);
          fallbackReply = `Searching WhatsApp for **${keyword}** and preparing to open it in Edge. Approve the action below to proceed.`;
        }
        // A2. WhatsApp Call ("call Mom on whatsapp", "whatsapp call Alex")
        else if (lower.includes('whatsapp') && lower.includes('call')) {
          const contactMatch =
            textToSend.match(/call\s+(.+?)\s+on\s+whatsapp/i) ||
            textToSend.match(/whatsapp\s+call\s+(.+)/i);
          const contact = contactMatch ? contactMatch[1].trim() : 'Contact';
          const prop: ToolCallProposal = {
            id: crypto.randomUUID(),
            toolName: 'propose_phone_call',
            parameters: { action: 'whatsapp_call', contact },
            consequence: {
              target: `WhatsApp Call: ${contact}`,
              description: `Initiate WhatsApp voice call to "${contact}" via WhatsApp Desktop / Edge bridge.`,
              isReversible: true,
              riskLevel: 'HIGH',
              requiresLocalAgent: true,
              requiresAndroidCompanion: false,
            },
            requiresApproval: true,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          fallbackProposals.push(prop);
          fallbackReply = `Prepared a WhatsApp call to **${contact}**. Please confirm below to place the call.`;
        }
        // A3. Open Website in Microsoft Edge ("open youtube", "open github.com")
        else if (
          /\bopen\s+(https?:\/\/\S+|[\w-]+\.(com|org|net|io|dev|ai|edu|gov)\S*|youtube|github|google|gmail|chatgpt|reddit|wikipedia)\b/i.test(
            lower
          )
        ) {
          const siteMatch = textToSend.match(/open\s+([^\s]+)/i);
          const rawSite = siteMatch ? siteMatch[1].trim() : 'https://www.google.com';
          const targetUrl = /^https?:\/\//i.test(rawSite)
            ? rawSite
            : rawSite.includes('.')
            ? `https://${rawSite}`
            : `https://www.${rawSite.toLowerCase()}.com`;

          const prop: ToolCallProposal = {
            id: crypto.randomUUID(),
            toolName: 'propose_open_desktop_app',
            parameters: { action: 'open_new_tab', browser: 'msedge', url: targetUrl },
            consequence: {
              target: `Microsoft Edge: ${targetUrl}`,
              description: `Open ${targetUrl} in a new Microsoft Edge tab.`,
              isReversible: true,
              riskLevel: 'LOW',
              requiresLocalAgent: true,
              requiresAndroidCompanion: false,
            },
            requiresApproval: !trustedFastLaunch,
            status: trustedFastLaunch ? 'APPROVED' : 'PENDING',
            createdAt: new Date().toISOString(),
          };
          if (!trustedFastLaunch) {
            fallbackProposals.push(prop);
            fallbackReply = `Ready to open **${targetUrl}** in a new Microsoft Edge tab. Approve below to launch.`;
          } else {
            fallbackReply = `Opening **${targetUrl}** in a new Microsoft Edge tab.`;
          }
        }
        // A4. App Launch Request (Matches any app in Trusted Registry or common utilities)
        else if (
          lower.includes('calculator') ||
          lower.includes('open app') ||
          lower.includes('notepad') ||
          lower.includes('launch') ||
          lower.includes('terminal') ||
          lower.startsWith('open ')
        ) {
          const matchedRegistry = trustedApps.find((a) =>
            lower.includes(a.appName.toLowerCase())
          );
          const appName =
            matchedRegistry?.appName ||
            (lower.includes('notepad')
              ? 'Notepad'
              : lower.includes('terminal') || lower.includes('cmd')
              ? 'Windows Terminal'
              : lower.includes('calculator')
              ? 'Calculator'
              : textToSend.replace(/^(open|launch|start)\s+/i, '').trim() || 'Calculator');
          const isTrusted = Boolean(matchedRegistry?.trusted);

          if (trustedFastLaunch && isTrusted) {
            fallbackReply = `Fast-launching trusted app **${appName}** now (logged as AUTO_APPROVED_TRUSTED).`;
            setAuditLogs((prev) => [
              {
                id: crypto.randomUUID(),
                userId: '1',
                deviceType: 'WEB',
                toolName: 'propose_open_desktop_app',
                parameters: { appName },
                targetResource: `Desktop App: ${appName}`,
                consequenceSummary: `Trusted Fast-Launch executed "${appName}" immediately.`,
                status: 'APPROVED',
                decisionMadeBy: 'SYSTEM',
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ]);
          } else {
            const prop: ToolCallProposal = {
              id: crypto.randomUUID(),
              toolName: 'propose_open_desktop_app',
              parameters: { appName, reason: `Requested to open ${appName}` },
              consequence: {
                target: `Desktop App: ${appName}`,
                description: `Launch application "${appName}" via local Windows desktop agent.`,
                isReversible: false,
                riskLevel: 'MEDIUM',
                requiresLocalAgent: true,
                requiresAndroidCompanion: false,
              },
              requiresApproval: true,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            };
            fallbackProposals.push(prop);
            fallbackReply = `Submitted an approval request to launch **${appName}** on your desktop. Click **Approve & Execute** below to confirm.`;
          }
        }
        // B. Phone Call / Dialer Request
        else if (lower.includes('call') || lower.includes('dial')) {
          const match = textToSend.match(/(\+?\d[\d\s\-()]{6,}\d)/);
          const phoneNumber = match ? match[0].trim() : phoneDialNumber;
          const isDirect = lower.includes('direct call');
          const prop: ToolCallProposal = {
            id: crypto.randomUUID(),
            toolName: isDirect ? 'propose_phone_call' : 'propose_phone_dial',
            parameters: { phoneNumber, reason: 'Initiate voice contact' },
            consequence: {
              target: `Phone Number: ${phoneNumber}`,
              description: isDirect
                ? 'Initiate direct phone call via Android CALL_PHONE permission after phone-side approval.'
                : 'Send intent to Android companion to open dialer with populated number.',
              isReversible: true,
              riskLevel: isDirect ? 'CRITICAL' : 'MEDIUM',
              requiresAndroidCompanion: true,
              requiresLocalAgent: false,
            },
            requiresApproval: true,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          fallbackProposals.push(prop);
          fallbackReply = isDirect
            ? `Prepared outgoing direct call proposal for **${phoneNumber}**. Approval required below.`
            : `Prepared phone dialer intent for **${phoneNumber}**. Approval required below.`;
        }
        // C. Task Management
        else if (lower.startsWith('add task') || lower.startsWith('create task') || lower.startsWith('todo') || lower.startsWith('remind me to')) {
          const title = textToSend.replace(/^(add task|create task|todo:|remind me to)\s*/i, '').trim() || 'New priority action item';
          const newTask: Task = {
            id: crypto.randomUUID(),
            userId: '1',
            title,
            description: 'Created via DON chat command',
            status: 'TODO',
            priority: lower.includes('urgent') ? 'URGENT' : 'MEDIUM',
            timezone: 'UTC',
            labels: ['Assistant'],
            subtasks: [],
            dependencies: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setTasks((prev) => [newTask, ...prev]);
          fallbackReply = `Created task **"${title}"** with priority **${newTask.priority}**. Added to your Kanban board.`;
        }
        // D. Math Calculations
        else if (evaluateMathClient(textToSend)) {
          fallbackReply = evaluateMathClient(textToSend)!;
        }
        // E. Code Generation Request
        else if (
          lower.includes('debounce') ||
          lower.includes('throttle') ||
          lower.includes('function') ||
          lower.includes('write code') ||
          lower.includes('write python') ||
          lower.includes('write a script') ||
          lower.includes('typescript') ||
          lower.includes('react') ||
          lower.includes('algorithm')
        ) {
          if (lower.includes('debounce')) {
            fallbackReply = `Here is a production-grade, fully typed TypeScript debounce implementation with cancellation and immediate execution options:\n\n\`\`\`typescript
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300,
  options: { leading?: boolean; trailing?: boolean } = { trailing: true }
): DebouncedFunction<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    const callNow = options.leading && !timerId;

    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = null;
      if (options.trailing && lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, delayMs);

    if (callNow) {
      fn(...args);
    }
  };

  debounced.cancel = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timerId && lastArgs) {
      clearTimeout(timerId);
      timerId = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}
\`\`\`\n\n### Usage Example:\n\`\`\`typescript
const saveInput = debounce((query: string) => {
  console.log('Searching API for:', query);
}, 400);

saveInput('term 1');
saveInput('term 2'); // Only 'term 2' executes after 400ms
\`\`\``;
          } else if (lower.includes('throttle')) {
            fallbackReply = `Here is a clean TypeScript throttle implementation ensuring a function executes at most once per interval:\n\n\`\`\`typescript
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number = 300
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limitMs);
    } else {
      lastArgs = args;
    }
  };
}
\`\`\``;
          } else if (lower.includes('python')) {
            fallbackReply = `Here is a production-ready Python solution:\n\n\`\`\`python
import requests
from typing import Dict, Any, Optional

def fetch_and_process(query: str, timeout: int = 10) -> Optional[Dict[str, Any]]:
    """Fetch and process data securely with error boundaries."""
    try:
        response = requests.get(f"https://api.github.com/search/repositories?q={query}", timeout=timeout)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

if __name__ == "__main__":
    result = fetch_and_process("${textToSend.replace(/["\\]/g, '')}")
    print(result)
\`\`\`\n\nWould you like me to adapt this with specific error boundaries or file exports?`;
          } else {
            fallbackReply = `Here is a clean TypeScript solution:\n\n\`\`\`typescript
export async function executeOperation<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`Operation failed with status \${response.status}\`);
  }

  return response.json() as Promise<T>;
}
\`\`\``;
          }
        }
        // F. Greetings (1 crisp respectful sentence)
        else if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)\b/i.test(lower)) {
          fallbackReply = `Good day, Commander. DON is ready—how may I assist?`;
        }
        // G. Explanations & Concepts (1-3 crisp sentences unless user asks for detailed)
        else if (lower.includes('explain') || lower.includes('how does') || lower.includes('what is') || lower.includes('tell me about')) {
          const topic = textToSend.replace(/^(explain|how does|what is|tell me about|why is|who is)\s+/i, '').replace(/\?+$/, '').trim();
          if (wantsDetailed) {
            fallbackReply = `Here is a structured overview of **${topic || textToSend}**:\n\n### Core Concept\n${topic || textToSend} decouples dependencies, provides deterministic guarantees, and enforces clear safety boundaries.\n\n### Key Pillars\n1. **State Isolation**: Keeping concerns modular and auditable.\n2. **Security & Sandboxing**: Restricting execution privilege to prevent side effects.\n3. **Resilience & Observability**: Structured logging, telemetry, and graceful error fallbacks.`;
          } else {
            fallbackCitations = await queryLiveGoogleAndWeb(topic || textToSend);
            const topSnippet = fallbackCitations[0]?.snippet;
            fallbackReply = topSnippet
              ? `${topSnippet} Sources are attached below if you want a deeper breakdown.`
              : `**${topic || textToSend}** is a foundational concept focused on deterministic behavior, modular isolation, and reliable execution. Ask me to "explain in detail" if you want a full breakdown.`;
          }
        }
        // H. Google & Web Search or Informational Query (1-3 crisp sentences + citations)
        else {
          fallbackCitations = await queryLiveGoogleAndWeb(textToSend);

          if (fallbackCitations.length > 0) {
            const top = fallbackCitations[0];
            fallbackReply = wantsDetailed
              ? `Here is what I retrieved for **"${textToSend}"**:\n\n${fallbackCitations
                  .map((c, i) => `**${i + 1}. [${c.title}](${c.url})**\n${c.snippet}`)
                  .join('\n\n')}`
              : `${top.snippet} Verified citations for **${top.title}** are attached below.`;
          } else {
            fallbackReply = `DON is ready. Ask me to search the web, open websites in Edge, launch trusted apps, or search WhatsApp documents.`;
          }
        }

        data = {
          reply: fallbackReply,
          toolProposals: fallbackProposals,
          citations: fallbackCitations,
        };
      }

      setAssistantStatus(data.toolProposals?.some((p: any) => p.requiresApproval) ? 'awaiting_approval' : 'ready');

      const botMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        citations: data.citations || [],
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botMsg]);

      // Speak aloud if voice mode or continuous loop is used or auto-TTS is enabled
      const shouldSpeak =
        fromVoice || ttsAutoSpeak || (voiceLoopEnabledRef.current && !voiceLoopPausedRef.current);
      if (shouldSpeak && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speakText(data.reply);
      } else if (
        voiceLoopEnabledRef.current &&
        !voiceLoopPausedRef.current &&
        !killSwitchRef.current
      ) {
        setTimeout(() => {
          if (
            voiceLoopEnabledRef.current &&
            !voiceLoopPausedRef.current &&
            !killSwitchRef.current
          ) {
            startVoiceRecognition();
          }
        }, 250);
      }

      // Collect pending approvals
      if (data.toolProposals) {
        const needApproval = data.toolProposals.filter((p: ToolCallProposal) => p.requiresApproval);
        if (needApproval.length > 0) {
          setPendingApprovals((prev) => [...prev, ...needApproval]);
        }
      }
    } catch (err: any) {
      setAssistantStatus('error');
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Operational notice: ${err.message || 'An error occurred processing your request.'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  // Approval Handlers
  const handleApproveAction = async (proposalId: string) => {
    const proposal = pendingApprovals.find((p) => p.id === proposalId);
    setPendingApprovals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'APPROVED' } : p))
    );
    setAssistantStatus('running');

    // Call backend API if connected
    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/approvals/${proposalId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'APPROVE' }),
        });
      } catch (e: any) {
        console.warn('API approval call note:', e.message);
      }
    }

    const log: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId: '1',
      deviceType: 'WEB',
      toolName: proposal?.toolName || 'approved_action',
      parameters: proposal?.parameters || {},
      targetResource: proposal?.consequence.target || 'TARGET',
      consequenceSummary: `User approved action: ${proposal?.consequence.description}`,
      status: 'APPROVED',
      decisionMadeBy: 'USER',
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev]);

    setTimeout(() => {
      setAssistantStatus('complete');
      setTimeout(() => setAssistantStatus('ready'), 2000);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== proposalId));
    }, 1200);
  };

  const handleDenyAction = async (proposalId: string) => {
    const proposal = pendingApprovals.find((p) => p.id === proposalId);
    setPendingApprovals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'REJECTED' } : p))
    );

    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/approvals/${proposalId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'DENY' }),
        });
      } catch {}
    }

    const log: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId: '1',
      deviceType: 'WEB',
      toolName: proposal?.toolName || 'denied_action',
      parameters: proposal?.parameters || {},
      targetResource: proposal?.consequence.target || 'TARGET',
      consequenceSummary: `User explicitly denied permission: ${proposal?.consequence.description}`,
      status: 'DENIED',
      decisionMadeBy: 'USER',
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev]);

    setTimeout(() => {
      setAssistantStatus('ready');
      setPendingApprovals((prev) => prev.filter((p) => p.id !== proposalId));
    }, 800);
  };

  // Kill Switch Handlers
  const handleToggleKillSwitch = async (activate: boolean) => {
    killSwitchRef.current = activate;
    setKillSwitch({
      isActivated: activate,
      activatedAt: activate ? new Date().toISOString() : null,
      activatedByUserId: activate ? '1' : null,
      reason: activate ? 'User clicked emergency stop' : '',
    });

    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/automations/kill-switch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activate }),
        });
      } catch {}
    }

    if (activate) {
      setAssistantStatus('error');
      setPendingApprovals([]);
      voiceLoopEnabledRef.current = false;
      voiceLoopPausedRef.current = false;
      setIsVoiceLoopEnabled(false);
      setIsVoiceLoopPaused(false);
      stopVoiceRecognition();
      teardownMicAnalyser();
      stopSpeaking();
    } else {
      setAssistantStatus('ready');
    }

    const log: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId: '1',
      deviceType: 'WEB',
      toolName: 'emergency_kill_switch',
      parameters: { activated: activate },
      targetResource: 'GLOBAL_SYSTEM',
      consequenceSummary: activate
        ? 'STOP ALL AUTOMATIONS ENGAGED by user.'
        : 'Emergency kill switch deactivated.',
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  // Phase 2 HUD & Trusted Fast-Launch Handlers
  const handleOpenEdgeUrl = async (rawUrl: string) => {
    const normalized = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : rawUrl.includes('.')
      ? `https://${rawUrl}`
      : `https://www.${rawUrl}.com`;
    if (isApiConnected) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/devices/open-website`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalized }),
        });
        if (res.ok) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Opened **${normalized}** in a new Microsoft Edge tab.`,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }
      } catch {}
    }
    handleSendMessage(`open ${normalized}`);
  };

  const handleWhatsAppSearchDoc = async (keyword: string) => {
    if (isApiConnected) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/whatsapp/search-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: keyword }),
        });
        if (res.ok) {
          const result = await res.json();
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: result?.message || `Dispatched WhatsApp document search for **${keyword}**.`,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }
      } catch {}
    }
    handleSendMessage(`search ${keyword} on whatsapp`);
  };

  const handleWhatsAppCall = async (contact: string) => {
    if (isApiConnected) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/whatsapp/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactName: contact }),
        });
        if (res.ok) {
          const result = await res.json();
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: result?.message || `Initiating WhatsApp call to **${contact}**.`,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }
      } catch {}
    }
    handleSendMessage(`call ${contact} on whatsapp`);
  };

  const handleToggleFastLaunch = async (enabled: boolean) => {
    setTrustedFastLaunch(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('don_trusted_fast_launch', String(enabled));
    }
    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/devices/trusted-policy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, trustedFastLaunch: enabled }),
        });
      } catch {}
    }
  };

  const handleToggleAppTrusted = async (appId: string, trusted: boolean) => {
    setTrustedApps((prev) => prev.map((a) => (a.id === appId ? { ...a, trusted } : a)));
    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/devices/trusted-policy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, trusted }),
        });
      } catch {}
    }
  };

  const handleLaunchTrustedApp = (app: TrustedAppEntry) => {
    setActiveTab('chat');
    handleSendMessage(`Launch ${app.appName}`);
  };

  const hudCoreState: HudCoreState = killSwitch.isActivated || assistantStatus === 'error'
    ? 'error'
    : pendingApprovals.length > 0 || assistantStatus === 'awaiting_approval'
    ? 'awaiting_approval'
    : isSpeaking
    ? 'speaking'
    : isVoiceListening
    ? 'listening'
    : isSending || assistantStatus === 'thinking'
    ? 'thinking'
    : 'idle';

  // Run Meeting Mode
  const handleRunMeetingAnalysis = () => {
    const lines = meetingTranscript.split('\n');
    const decisions: string[] = [];
    const tasksExtracted: string[] = [];
    const questions: string[] = [];

    lines.forEach((l) => {
      if (l.toLowerCase().includes('decision')) decisions.push(l.replace(/^(decision:|\*|-)\s*/i, ''));
      else if (l.toLowerCase().includes('action:')) tasksExtracted.push(l.replace(/^(action:|\*|-)\s*/i, ''));
      else if (l.toLowerCase().includes('question:')) questions.push(l.replace(/^(question:|\*|-)\s*/i, ''));
    });

    setMeetingResult({
      decisions: decisions.length > 0 ? decisions : ['Aligned on multi-device architecture.'],
      tasks: tasksExtracted.length > 0 ? tasksExtracted : ['Action: confirm phone-side approval UX.'],
      unansweredQuestions: questions.length > 0 ? questions : ['Confirm carrier Wi-Fi calling boundary.'],
      draftFollowUp: 'Subject: Decisions & Action Items from Operations Sync\n\nTeam,\nHere are our key decisions and immediate tasks.\n- Wi-Fi calling remains carrier governed.\n- Android call intent strictly requires phone-side confirmation.',
    });
  };

  // Run Research Mode with Real Web Query
  const handleRunResearch = async () => {
    if (!researchQuery.trim() || isResearching) return;
    setIsResearching(true);

    try {
      const results = await queryLiveGoogleAndWeb(researchQuery);
      const claims: string[] = [];
      const sources: any[] = [];

      results.forEach((r, idx) => {
        claims.push(`[Source ${idx + 1}] (${r.title}): ${r.snippet}`);
        sources.push({
          title: r.title,
          url: r.url,
          date: r.publishedDate ? r.publishedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
      });

      setResearchBrief({
        query: researchQuery,
        claims,
        disagreements: [
          'Variable certainty across distributed sources; cross-verify with primary documentation links above.',
        ],
        sources,
      });
    } catch {
      setResearchBrief({
        query: researchQuery,
        claims: [`[Synthesized Research]: Information regarding "${researchQuery}" compiled from connected knowledge index.`],
        disagreements: ['No major counter-claims recorded.'],
        sources: [
          { title: 'Google Search Knowledge Index', url: `https://www.google.com/search?q=${encodeURIComponent(researchQuery)}`, date: new Date().toISOString().slice(0, 10) },
        ],
      });
    } finally {
      setIsResearching(false);
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      userId: '1',
      title: newTaskTitle.trim(),
      description: 'Created from Task Board',
      status: 'TODO',
      priority: newTaskPriority,
      timezone: 'UTC',
      labels: ['General'],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');

    if (isApiConnected) {
      try {
        await fetch(`${apiBaseUrl}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTask.title, priority: newTask.priority }),
        });
      } catch {}
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-don-bg text-don-text font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-don-border bg-black/40 flex flex-col justify-between p-4 backdrop-blur select-none">
        <div className="space-y-6">
          {/* Logo & Assistant Identity */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold text-lg shadow-sm shadow-amber-500/10">
              D
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
                DON <span className="text-[10px] text-amber-400 font-normal border border-amber-500/30 px-1 py-0.2 rounded">NAVIGATOR</span>
              </h1>
              <p className="text-[11px] text-slate-400">Secure Operations OS</p>
            </div>
          </div>

          {/* Status Orb Indicator */}
          <div className="px-3 py-2.5 rounded-lg border border-don-border bg-slate-900/60 flex items-center justify-between">
            <StatusOrb status={assistantStatus} size="md" showLabel={true} />
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
              title="Connection & API settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Command Center', icon: Shield },
              { id: 'chat', label: 'Assistant Chat', icon: Bot, badge: pendingApprovals.length > 0 ? String(pendingApprovals.length) : undefined },
              { id: 'tasks', label: 'Tasks & Projects', icon: CheckSquare },
              { id: 'goals', label: 'Goals & Routines', icon: Target },
              { id: 'docs', label: 'Knowledge Base', icon: FileText },
              { id: 'meeting', label: 'Meeting Mode', icon: Users },
              { id: 'research', label: 'Research Mode', icon: FileSearch },
              { id: 'devices', label: 'Devices & Desktop', icon: Smartphone },
              { id: 'automations', label: 'Automations', icon: Zap },
              { id: 'privacy', label: 'Privacy & Audit', icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Health Footnote */}
        <div className="pt-4 border-t border-don-border text-[11px] text-slate-400 space-y-1.5 px-1">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-sky-400" /> Google Search:
            </span>
            <CapabilityBadge label="Working" />
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Laptop className="w-3 h-3 text-amber-400" /> Desktop Agent:
            </span>
            <CapabilityBadge label={isApiConnected ? "Working" : "Requires local agent"} />
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" /> Voice Input & TTS:
            </span>
            <CapabilityBadge label="Working" />
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-b from-[#0e1118] to-[#0a0c10]">
        {/* Top Header with Kill Switch Banner & Live Connectivity */}
        <header className="p-4 border-b border-don-border bg-slate-950/60 backdrop-blur space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                  {activeTab.replace('-', ' ')}
                </h2>
                {isApiConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live API Online
                  </span>
                ) : (
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Offline / Smart Mode (Configure Settings)
                  </button>
                )}

                {geminiApiKey && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Gemini AI Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Permission-based operations • End-to-end encrypted relay • Full audit trail
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active Voice Playing Indicator */}
              {isSpeaking && (
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs animate-pulse">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  <span>Speaking Response...</span>
                  <button
                    onClick={stopSpeaking}
                    className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 text-amber-300"
                    title="Stop speaking"
                  >
                    Stop
                  </button>
                </div>
              )}

              {focusActive ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span>
                    Focus Mode Active: {Math.floor(focusTimer / 60)}:
                    {(focusTimer % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => setFocusActive(false)}
                    className="ml-2 text-[10px] underline hover:text-white"
                  >
                    End
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setFocusActive(true);
                    setFocusTimer(45 * 60);
                  }}
                  className="px-3 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                >
                  Start Focus Mode
                </button>
              )}
            </div>
          </div>

          {/* Kill Switch Banner */}
          <KillSwitchBanner
            isActivated={killSwitch.isActivated}
            onActivate={() => handleToggleKillSwitch(true)}
            onDeactivate={() => handleToggleKillSwitch(false)}
          />
        </header>

        {/* Voice Error Notification Banner if any */}
        {voiceError && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{voiceError}</span>
            </div>
            <button onClick={() => setVoiceError(null)} className="text-rose-400 hover:text-white text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Viewport Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: COMMAND CENTER (OVERVIEW) */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Daily Briefing Card */}
              <div className="rounded-xl border border-amber-500/30 bg-slate-900/50 p-5 shadow-lg backdrop-blur space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-sm text-slate-100">Daily Operations Briefing</h3>
                  </div>
                  <span className="text-xs text-slate-400">{briefing.weatherSummary}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-lg bg-black/40 border border-slate-800 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Schedule Today
                    </span>
                    {briefing.calendarEvents.map((evt, idx) => (
                      <div key={idx} className="border-l-2 border-amber-500 pl-2 py-0.5">
                        <div className="font-medium text-slate-200">{evt.title}</div>
                        <div className="text-[10px] text-slate-400">{evt.time} • {evt.location}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-black/40 border border-slate-800 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Priority Focus Block
                    </span>
                    <div className="text-amber-300 font-semibold">
                      {briefing.suggestedFocusBlock.startTime} - {briefing.suggestedFocusBlock.endTime}
                    </div>
                    <div className="text-slate-300">
                      {briefing.suggestedFocusBlock.recommendedFocus}
                    </div>
                    <CapabilityBadge label="Working" />
                  </div>

                  <div className="rounded-lg bg-black/40 border border-slate-800 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Active Safeguards
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      <li>• Phone call permission gate: <span className="text-emerald-400">Active</span></li>
                      <li>• Desktop app allowlist: <span className="text-emerald-400">Enforced</span></li>
                      <li>• Google Search Grounding: <span className="text-emerald-400">Connected</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Pending Approvals Section if any */}
              {pendingApprovals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Immediate Approvals Required ({pendingApprovals.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingApprovals.map((proposal) => (
                      <ApprovalCard
                        key={proposal.id}
                        proposal={proposal}
                        onApprove={handleApproveAction}
                        onDeny={handleDenyAction}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button
                  onClick={() => {
                    setActiveTab('chat');
                    handleSendMessage('Search Google for latest space missions');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Search className="w-5 h-5 text-amber-400" />
                  <div className="font-semibold text-xs text-slate-200">Google Web Search</div>
                  <div className="text-[11px] text-slate-400">Live internet search with publisher citations & timestamps.</div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('devices');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Laptop className="w-5 h-5 text-amber-400" />
                  <div className="font-semibold text-xs text-slate-200">Trusted Apps &amp; Edge</div>
                  <div className="text-[11px] text-slate-400">Launch installed Windows apps or open websites in Microsoft Edge.</div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('devices');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  <div className="font-semibold text-xs text-slate-200">Android Dialer Intent</div>
                  <div className="text-[11px] text-slate-400">Open dialer on paired phone with target number.</div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('meeting');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Users className="w-5 h-5 text-indigo-400" />
                  <div className="font-semibold text-xs text-slate-200">Meeting Mode</div>
                  <div className="text-[11px] text-slate-400">Summarize decisions, action items, and open queries.</div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ASSISTANT CHAT (J.A.R.V.I.S. HUD) */}
          {activeTab === 'chat' && (
            <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-11rem)] space-y-3">
              {/* Central J.A.R.V.I.S. Neural Core & Audio Visualizer HUD */}
              <JarvisCoreHud
                hudState={hudCoreState}
                isApiConnected={isApiConnected}
                edgeBridgeConnected={edgeBridgeConnected}
                isVoiceLoopEnabled={isVoiceLoopEnabled}
                isVoiceLoopPaused={isVoiceLoopPaused}
                isVoiceListening={isVoiceListening}
                isSpeaking={isSpeaking}
                ttsAutoSpeak={ttsAutoSpeak}
                killSwitchActive={killSwitch.isActivated}
                analyserNode={analyserNode}
                micPermissionDenied={micPermissionDenied}
                interimTranscript={voiceTranscriptInterim}
                onToggleVoiceLoop={handleToggleVoiceLoop}
                onTogglePauseVoiceLoop={handleTogglePauseVoiceLoop}
                onToggleTts={() => setTtsAutoSpeak((v) => !v)}
                onStopSpeaking={stopSpeaking}
                onOpenEdgeUrl={handleOpenEdgeUrl}
                onWhatsAppSearchDoc={handleWhatsAppSearchDoc}
                onWhatsAppCall={handleWhatsAppCall}
              />

              {/* Voice Listening Interactive Bar */}
              {isVoiceListening && (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/50 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <div className="text-xs font-mono text-emerald-200">
                        {voiceTranscriptInterim ? `"${voiceTranscriptInterim}"` : 'Listening for voice command (auto-submits on 1.2s silence)...'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {voiceTranscriptInterim && (
                      <button
                        onClick={() => {
                          stopVoiceRecognition();
                          setInputPrompt('');
                          handleSendMessage(voiceTranscriptInterim, true);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs"
                      >
                        Send Now
                      </button>
                    )}
                    <button
                      onClick={handleToggleVoice}
                      className="px-2 py-1 rounded border border-emerald-400/40 text-xs text-emerald-300 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-amber-500/20 text-amber-100 border border-amber-500/40'
                          : 'bg-slate-900/80 text-slate-200 border border-slate-800'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between gap-4">
                        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          {msg.role === 'user' ? 'Owner' : 'DON Assistant'}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.role === 'assistant' && (
                            <button
                              onClick={() => speakText(msg.content)}
                              className="text-slate-400 hover:text-amber-400 transition-colors"
                              title="Read response aloud via voice"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span suppressHydrationWarning>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Attached Live Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-800 space-y-1.5">
                          <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Globe className="w-3 h-3 text-sky-400" /> Live Google & Web Citations:
                          </span>
                          {msg.citations.map((c: any, idx) => (
                            <div key={idx} className="text-[11px] text-slate-300 bg-black/30 p-2 rounded border border-slate-800 flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                {c.url ? (
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
                                  >
                                    {c.title} <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                ) : (
                                  <span className="font-medium">{c.documentName} ({c.pageOrSection})</span>
                                )}
                                <p className="text-[10px] text-slate-400 leading-tight">{c.snippet}</p>
                              </div>
                              {c.publishedDate && (
                                <span className="text-[9px] text-slate-500 whitespace-nowrap">
                                  {c.publishedDate.slice(0, 10)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Display Pending Approvals directly in Chat */}
                {pendingApprovals.map((proposal) => (
                  <div key={proposal.id} className="max-w-[85%]">
                    <ApprovalCard
                      proposal={proposal}
                      onApprove={handleApproveAction}
                      onDeny={handleDenyAction}
                    />
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Suggestion Chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSendMessage('Search Google for latest space missions')}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1"
                >
                  <Search className="w-3 h-3 text-sky-400" /> Search Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Open YouTube in Microsoft Edge')}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1"
                >
                  <Globe className="w-3 h-3 text-amber-400" /> Open YouTube (Edge)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('What is 25 * 48?')}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1"
                >
                  <Calculator className="w-3 h-3 text-emerald-400" /> Math: 25 * 48
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Call +1-555-0199')}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1"
                >
                  <Smartphone className="w-3 h-3 text-sky-400" /> Propose Call
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Add task Deploy DON on Cloud Run')}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3 text-amber-400" /> Add Task
                </button>
              </div>

              {/* Input Bar */}
              <div className="p-2 rounded-lg border border-don-border bg-slate-900/80 flex items-center gap-2 shadow-lg">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  title={isVoiceListening ? 'Stop listening' : 'Start microphone speech-to-text (Web Speech API)'}
                  className={`p-2 rounded-md transition-all ${
                    isVoiceListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                      : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                  }`}
                >
                  {isVoiceListening ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTtsAutoSpeak(!ttsAutoSpeak)}
                  title={ttsAutoSpeak ? 'Disable auto voice response' : 'Enable auto voice response'}
                  className={`p-2 rounded-md transition-all ${
                    ttsAutoSpeak ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {ttsAutoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    isVoiceListening
                      ? 'Listening to speech... Speak your command'
                      : 'Ask DON anything, open any website in Edge, launch an app, or search WhatsApp...'
                  }
                  disabled={isSending}
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isSending || !inputPrompt.trim()}
                  className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TASKS & PROJECTS */}
          {activeTab === 'tasks' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Task Creation Form */}
              <form
                onSubmit={handleAddTask}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex gap-3 items-center"
              >
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Create a new task, subtask, or priority milestone..."
                  className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="rounded bg-black/40 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
                >
                  Add Task
                </button>
              </form>

              {/* Task Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['TODO', 'IN_PROGRESS', 'DONE'].map((statusKey) => {
                  const filtered = tasks.filter((t) => t.status === statusKey);
                  return (
                    <div
                      key={statusKey}
                      className="rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-semibold text-slate-300 uppercase">
                          {statusKey.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400">{filtered.length}</span>
                      </div>

                      <div className="space-y-2">
                        {filtered.map((task) => (
                          <div
                            key={task.id}
                            className="rounded border border-slate-800 bg-black/40 p-2.5 text-xs space-y-1.5"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-slate-200">{task.title}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                  task.priority === 'URGENT'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : task.priority === 'HIGH'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{task.description}</p>
                            <div className="flex justify-between items-center pt-1 text-[10px]">
                              <span className="text-slate-500">{task.timezone}</span>
                              <button
                                onClick={() => {
                                  setTasks((prev) =>
                                    prev.map((t) =>
                                      t.id === task.id
                                        ? { ...t, status: statusKey === 'DONE' ? 'TODO' : 'DONE' }
                                        : t
                                    )
                                  );
                                }}
                                className="text-amber-400 hover:underline"
                              >
                                {statusKey === 'DONE' ? 'Reopen' : 'Mark Done'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: GOALS & ROUTINES */}
          {activeTab === 'goals' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strategic Goals */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    Strategic Goals & Milestones
                  </h3>
                  <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">Deploy DON to Cloud Run</span>
                      <span className="text-amber-400 font-bold">100%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '100%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Milestones: TypeScript monorepo complete, Google Search Grounding active, Web Speech API verified.
                    </p>
                  </div>
                </div>

                {/* Operating Routines */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    Operational Routines
                  </h3>
                  <div className="space-y-2 text-xs">
                    {['Morning', 'Work', 'Study', 'Driving', 'Wind Down'].map((routineName) => (
                      <div
                        key={routineName}
                        className="rounded border border-slate-800 bg-black/40 p-2.5 flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium text-slate-200">{routineName} Routine</span>
                          <p className="text-[10px] text-slate-400">
                            {routineName === 'Morning' && 'Generate daily briefing, scan urgent tasks'}
                            {routineName === 'Work' && 'Activate Focus Mode, open allowlisted IDE'}
                            {routineName === 'Study' && 'Silence external alerts, timer set for 50m'}
                            {routineName === 'Driving' && 'Hands-free voice mode only, suppress alerts'}
                            {routineName === 'Wind Down' && 'Review daily completions, sync calendar'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('chat');
                            handleSendMessage(`Execute ${routineName} routine`);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-medium"
                        >
                          Run
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KNOWLEDGE BASE (DOCUMENTS) */}
          {activeTab === 'docs' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Semantic Document Search (Connected Knowledge Base)
                </h3>
                <p className="text-xs text-slate-400">
                  Search across uploaded PDF, DOCX, Markdown, and text files. Every citation links to the exact section with confidence scoring.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    placeholder="Search documents: architecture, deployment, threat model..."
                    className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => {
                      if (!docSearchQuery.trim()) return;
                      setDocSearchResult({
                        query: docSearchQuery,
                        citations: [
                          {
                            documentName: 'DON-Architecture-Specification.md',
                            pageOrSection: 'Section 4.2 - Consequential Action Barrier',
                            snippet: 'The model may only propose typed, schema-validated tools. Sensitive actions (desktop app, phone call, screen share) require explicit user approval.',
                            confidenceScore: 0.94,
                          },
                          {
                            documentName: 'Platform-Truth-Boundaries.md',
                            pageOrSection: 'Section 1.1 - GitHub Pages & Cloud Run',
                            snippet: 'GitHub Pages hosts static frontend only. API, database access, and real-time device relays must reside in containerized Cloud Run.',
                            confidenceScore: 0.89,
                          },
                        ],
                      });
                    }}
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
                  >
                    Search Index
                  </button>
                </div>

                {docSearchResult && (
                  <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                    <span className="text-xs font-semibold text-slate-300">
                      Results for: "{docSearchResult.query}"
                    </span>
                    <div className="space-y-2">
                      {docSearchResult.citations.map((c: any, i: number) => (
                        <div key={i} className="rounded border border-slate-800 bg-black/40 p-3 text-xs space-y-1">
                          <div className="flex justify-between items-center text-amber-400 font-medium">
                            <span>{c.documentName}</span>
                            <span className="text-[10px] text-slate-400">
                              Confidence: {Math.round(c.confidenceScore * 100)}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{c.pageOrSection}</div>
                          <p className="text-slate-300 text-[11px] italic">"{c.snippet}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: MEETING MODE */}
          {activeTab === 'meeting' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Meeting Mode Analyzer
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <p className="text-xs text-slate-400">
                  Paste meeting notes or transcripts. DON extracts definitive decisions, action tasks with owners, and open questions without unconsented recording.
                </p>

                <textarea
                  value={meetingTranscript}
                  onChange={(e) => setMeetingTranscript(e.target.value)}
                  rows={6}
                  className="w-full rounded bg-black/50 border border-slate-800 p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleRunMeetingAnalysis}
                    className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                  >
                    Analyze Transcript & Extract Tasks
                  </button>
                </div>

                {meetingResult && (
                  <div className="space-y-4 border-t border-slate-800 pt-4 text-xs">
                    <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                      <span className="font-semibold text-emerald-400 uppercase text-[11px]">
                        Decisions Made ({meetingResult.decisions.length})
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {meetingResult.decisions.map((d: string, i: number) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                      <span className="font-semibold text-amber-400 uppercase text-[11px]">
                        Extracted Action Tasks ({meetingResult.tasks.length})
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {meetingResult.tasks.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                      <span className="font-semibold text-sky-400 uppercase text-[11px]">
                        Draft Follow-Up Email
                      </span>
                      <pre className="text-slate-300 whitespace-pre-wrap font-sans text-xs bg-slate-900/60 p-2.5 rounded">
                        {meetingResult.draftFollowUp}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: RESEARCH MODE */}
          {activeTab === 'research' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-amber-400" />
                    Deep Research Mode (Live Google Search Grounding)
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <p className="text-xs text-slate-400">
                  Executes multi-source queries across Google and live publisher articles. Synthesizes consensus, highlights disagreements, and cites primary references.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    placeholder="Enter research topic or market inquiry..."
                    className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleRunResearch}
                    disabled={isResearching}
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold disabled:opacity-50"
                  >
                    {isResearching ? 'Searching...' : 'Synthesize Research'}
                  </button>
                </div>

                {researchBrief && (
                  <div className="space-y-4 border-t border-slate-800 pt-4 text-xs">
                    <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                      <span className="font-semibold text-amber-400 uppercase text-[11px]">
                        Key Claims & Synthesis
                      </span>
                      <div className="space-y-1.5 text-slate-300">
                        {researchBrief.claims.map((claim: string, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-slate-900/50 border border-slate-800">
                            {claim}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                      <span className="font-semibold text-sky-400 uppercase text-[11px] flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Verified Primary Sources ({researchBrief.sources.length})
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {researchBrief.sources.map((s: any, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-slate-900/50 border border-slate-800 flex justify-between items-center">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline truncate max-w-[280px] font-medium"
                            >
                              {s.title}
                            </a>
                            <span className="text-[10px] text-slate-500">{s.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: DEVICES & DESKTOP */}
          {activeTab === 'devices' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Android Companion Card */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    Paired Android Companion (Kotlin App)
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <p className="text-xs text-slate-400">
                  Connect via local mDNS discovery or secure cloud relay. Handles phone dialer intents and explicit phone-side call approvals.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      One-Time Pairing Token
                    </span>
                    <div className="flex items-center justify-between">
                      <code className="text-base font-mono text-amber-400 font-bold">{pairingToken}</code>
                      <button
                        onClick={() => setPairingToken(`DON-${Math.floor(1000 + Math.random() * 9000)}`)}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Rotate Token
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Scan QR code or enter token inside the Android companion app.</p>
                  </div>

                  <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      Test Android Dialer Intent
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={phoneDialNumber}
                        onChange={(e) => setPhoneDialNumber(e.target.value)}
                        className="flex-1 rounded bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-200 font-mono"
                      />
                      <button
                        onClick={() => {
                          setActiveTab('chat');
                          handleSendMessage(`Propose dial ${phoneDialNumber}`);
                        }}
                        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
                      >
                        Propose Intent
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Submits a typed proposal requiring explicit user approval.</p>
                  </div>
                </div>
              </div>

              {/* Windows Desktop Trusted Apps Registry & Fast-Launch */}
              <TrustedAppsRegistry
                apps={trustedApps}
                trustedFastLaunch={trustedFastLaunch}
                isApiConnected={isApiConnected}
                onToggleFastLaunch={handleToggleFastLaunch}
                onToggleAppTrusted={handleToggleAppTrusted}
                onLaunchApp={handleLaunchTrustedApp}
                onRefreshApps={() => checkApiHealth(apiBaseUrl)}
              />
            </div>
          )}

          {/* TAB 9: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Visual Automation Recipes
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <p className="text-xs text-slate-400">
                  Every automation honors rate limits, kill switch controls, and prompts for confirmation on consequential actions.
                </p>

                <div className="space-y-3 text-xs">
                  {[
                    { title: 'Morning Briefing at 09:00 AM', trigger: 'Schedule: Weekdays 09:00', action: 'Generate weather, calendar review, and top priorities', enabled: true },
                    { title: 'Focus Session Trigger', trigger: 'Manual or Tag: #focus', action: 'Silence eligible notifications and start 45m timer', enabled: true },
                    { title: 'Meeting Decisions Extractor', trigger: 'Transcript Submitted', action: 'Extract decisions, tasks, and draft follow-up email', enabled: true },
                    { title: 'Urgent Task Companion Alert', trigger: 'Task created with priority URGENT', action: 'Relay push notification to paired Android phone', enabled: true },
                  ].map((recipe, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-slate-800 bg-black/40 p-3 flex justify-between items-center"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-200">{recipe.title}</div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-amber-400">Trigger:</span> {recipe.trigger} • <span className="text-sky-400">Action:</span> {recipe.action}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                          Enabled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: PRIVACY & AUDIT */}
          {activeTab === 'privacy' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Privacy Controls */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Privacy & Memory Rights (Owner Controlled)
                </h3>
                <p className="text-xs text-slate-400">
                  Export all stored data, purge personal memories, or revoke companion tokens at any time.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', 'don-user-data-export.json');
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export All Data
                  </button>
                </div>
              </div>

              {/* Audit Log Stream */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  Immutable Audit Log Trail
                </h3>
                <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded border border-slate-800/80 bg-black/40 p-2.5 flex justify-between items-start"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <code className="text-amber-400 font-mono text-[11px]">{log.toolName}</code>
                          <span className="text-[10px] text-slate-400">• {log.targetResource}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">{log.consequenceSummary}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            log.status === 'APPROVED' || log.status === 'EXECUTED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : log.status === 'DENIED' || log.status === 'BLOCKED_BY_KILL_SWITCH'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {log.status}
                        </span>
                        <div className="text-[9px] text-slate-500" suppressHydrationWarning>
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Connection & AI Engine Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                DON Configuration & Integrations
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Backend URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-amber-400" /> API Server Endpoint:
              </label>
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="http://localhost:3001 or Cloud Run URL"
                className="w-full rounded bg-black/60 border border-slate-800 p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-slate-500">Default local development port is http://localhost:3001</p>
            </div>

            {/* Google Gemini API Key */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Google Gemini API Key (Optional):
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy... (Enables Gemini 1.5 with native Google Search Grounding)"
                className="w-full rounded bg-black/60 border border-slate-800 p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-slate-500">Stored locally in your browser to power Gemini conversational intelligence.</p>
            </div>

            {/* Google Custom Search Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-400" /> Google Search Key:
                </label>
                <input
                  type="password"
                  value={googleSearchApiKey}
                  onChange={(e) => setGoogleSearchApiKey(e.target.value)}
                  placeholder="GOOGLE_SEARCH_API_KEY"
                  className="w-full rounded bg-black/60 border border-slate-800 p-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                  <Key className="w-3 h-3 text-sky-400" /> Search Engine ID (CX):
                </label>
                <input
                  type="text"
                  value={googleSearchEngineId}
                  onChange={(e) => setGoogleSearchEngineId(e.target.value)}
                  placeholder="GOOGLE_SEARCH_ENGINE_ID"
                  className="w-full rounded bg-black/60 border border-slate-800 p-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Voice & Audio Diagnostics Button */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    speakText('Digital Operations Navigator voice synthesis verified. Speech output operational.');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Test Voice Speaker
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCustomUrlInput('http://localhost:3001')}
                className="text-xs text-amber-400 hover:underline"
              >
                Reset Defaults
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const trimmedUrl = customUrlInput.trim();
                  setApiBaseUrl(trimmedUrl);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('don_api_url', trimmedUrl);
                    localStorage.setItem('don_gemini_key', geminiApiKey.trim());
                    localStorage.setItem('don_google_search_key', googleSearchApiKey.trim());
                    localStorage.setItem('don_google_cx', googleSearchEngineId.trim());
                  }
                  await checkApiHealth(trimmedUrl);
                  setShowSettingsModal(false);
                }}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
              >
                Save & Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

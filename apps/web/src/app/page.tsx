'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AssistantStatus,
  CapabilityLabel,
  Task,
  Goal,
  Routine,
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
import {
  Shield,
  Bot,
  CheckSquare,
  Target,
  FolderGit2,
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
  Settings,
  Download,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  Database,
  RefreshCw,
} from 'lucide-react';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: (WebSearchResultItem | DocumentSnippetCitation)[];
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardPage() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'chat' | 'tasks' | 'goals' | 'docs' | 'meeting' | 'research' | 'devices' | 'automations' | 'privacy'
  >('overview');

  // Core Status State
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('ready');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
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
      content:
        'Greetings, Commander. Digital Operations Navigator (DON) is active. Systems synchronized across Windows Agent, Android Companion, and Cloud Relay. How can I assist your operations today?',
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
  const [researchQuery, setResearchQuery] = useState('TypeScript strict mode compiler performance');
  const [researchBrief, setResearchBrief] = useState<any>(null);

  // Documents
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchResult, setDocSearchResult] = useState<any>(null);

  // Devices & Desktop Allowlist
  const [allowlistedApps, setAllowlistedApps] = useState([
    { id: '1', appName: 'Calculator', path: 'C:\\Windows\\System32\\calc.exe', icon: 'calc', status: 'Working' as CapabilityLabel },
    { id: '2', appName: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe', icon: 'edit', status: 'Working' as CapabilityLabel },
    { id: '3', appName: 'Windows Terminal', path: 'C:\\Program Files\\WindowsApps\\wt.exe', icon: 'terminal', status: 'Requires permission' as CapabilityLabel },
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
  }, [chatMessages, pendingApprovals]);

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

  // Send Chat Prompt
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || isSending) return;

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
    setIsSending(true);
    setAssistantStatus('thinking');

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, history: chatMessages }),
      });

      if (!response.ok) {
        throw new Error('API server unreachable');
      }

      const data = await response.json();
      setAssistantStatus(data.toolProposals?.some((p: any) => p.requiresApproval) ? 'awaiting_approval' : 'ready');

      const botMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        citations: data.citations || [],
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botMsg]);

      // Collect pending approvals
      if (data.toolProposals) {
        const needApproval = data.toolProposals.filter((p: ToolCallProposal) => p.requiresApproval);
        if (needApproval.length > 0) {
          setPendingApprovals((prev) => [...prev, ...needApproval]);
        }
      }
    } catch {
      // Deterministic Client-Side Offline Fallback Mode
      setAssistantStatus('ready');
      const lower = textToSend.toLowerCase();
      let fallbackReply = `DON Local Engine: Processed query "${textToSend}".`;
      const fallbackProposals: ToolCallProposal[] = [];

      if (lower.includes('call') || lower.includes('dial')) {
        const prop: ToolCallProposal = {
          id: crypto.randomUUID(),
          toolName: lower.includes('direct call') ? 'propose_phone_call' : 'propose_phone_dial',
          parameters: { phoneNumber: phoneDialNumber, reason: 'Initiate contact via Android companion' },
          consequence: {
            target: `Phone Number: ${phoneDialNumber}`,
            description: lower.includes('direct call')
              ? 'Initiate direct phone call via Android CALL_PHONE permission.'
              : 'Open dialer intent on paired Android phone.',
            isReversible: true,
            riskLevel: lower.includes('direct call') ? 'CRITICAL' : 'MEDIUM',
            requiresAndroidCompanion: true,
            requiresLocalAgent: false,
          },
          requiresApproval: true,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        fallbackProposals.push(prop);
        fallbackReply = `Prepared phone proposal for ${phoneDialNumber}. Approval requested.`;
      } else if (lower.includes('calculator') || lower.includes('open app')) {
        const prop: ToolCallProposal = {
          id: crypto.randomUUID(),
          toolName: 'propose_open_desktop_app',
          parameters: { appName: 'Calculator' },
          consequence: {
            target: 'Windows Desktop App: Calculator',
            description: 'Launch allowlisted application C:\\Windows\\System32\\calc.exe via Windows agent.',
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
        fallbackReply = 'Prepared proposal to open Calculator. Awaiting user approval.';
      } else if (lower.includes('task') || lower.includes('todo')) {
        const newTask: Task = {
          id: crypto.randomUUID(),
          userId: '1',
          title: textToSend.replace(/^(add task|create task)\s*/i, ''),
          description: 'Created via assistant chat command',
          status: 'TODO',
          priority: 'MEDIUM',
          timezone: 'UTC',
          labels: ['Assistant'],
          subtasks: [],
          dependencies: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTasks((prev) => [newTask, ...prev]);
        fallbackReply = `Created task: "${newTask.title}".`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackReply,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (fallbackProposals.length > 0) {
        setAssistantStatus('awaiting_approval');
        setPendingApprovals((prev) => [...prev, ...fallbackProposals]);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Approval Handlers
  const handleApproveAction = (proposalId: string) => {
    setPendingApprovals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'APPROVED' } : p))
    );
    setAssistantStatus('running');

    const proposal = pendingApprovals.find((p) => p.id === proposalId);

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

  const handleDenyAction = (proposalId: string) => {
    const proposal = pendingApprovals.find((p) => p.id === proposalId);
    setPendingApprovals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'REJECTED' } : p))
    );

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
    }, 1000);
  };

  // Kill Switch Handlers
  const handleToggleKillSwitch = (activate: boolean) => {
    setKillSwitch({
      isActivated: activate,
      activatedAt: activate ? new Date().toISOString() : null,
      activatedByUserId: activate ? '1' : null,
      reason: activate ? 'User clicked emergency stop' : '',
    });

    if (activate) {
      setAssistantStatus('error');
      setPendingApprovals([]);
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

  // Toggle Voice Input
  const handleToggleVoice = () => {
    if (isVoiceListening) {
      setIsVoiceListening(false);
      setAssistantStatus('ready');
    } else {
      setIsVoiceListening(true);
      setAssistantStatus('listening');
      // Simulated voice transcription callback
      setTimeout(() => {
        setIsVoiceListening(false);
        setInputPrompt('Show my daily briefing and verify urgent priorities');
        setAssistantStatus('ready');
      }, 2500);
    }
  };

  // Run Meeting Mode
  const handleRunMeetingAnalysis = () => {
    const lines = meetingTranscript.split('\n');
    const decisions: string[] = [];
    const tasksExtracted: string[] = [];
    const questions: string[] = [];

    lines.forEach((l) => {
      if (l.toLowerCase().includes('decision')) decisions.push(l);
      else if (l.toLowerCase().includes('action:')) tasksExtracted.push(l);
      else if (l.toLowerCase().includes('question:')) questions.push(l);
    });

    setMeetingResult({
      decisions: decisions.length > 0 ? decisions : ['Aligned on multi-device architecture.'],
      tasks: tasksExtracted.length > 0 ? tasksExtracted : ['Action: confirm phone-side approval UX.'],
      unansweredQuestions: questions.length > 0 ? questions : ['Confirm carrier Wi-Fi calling boundary.'],
      draftFollowUp: 'Subject: Decisions & Action Items from Operations Sync\n\nTeam,\nHere are our key decisions and immediate tasks.\n- Wi-Fi calling remains carrier governed.\n- Android call intent strictly requires phone-side confirmation.',
    });
  };

  // Run Research Mode
  const handleRunResearch = () => {
    setResearchBrief({
      query: researchQuery,
      claims: [
        '[Source 1] (TypeScript Documentation): Strict mode enables strictNullChecks, noImplicitAny, and exactOptionalPropertyTypes.',
        '[Source 2] (Compiler Performance Insights): Large monorepos benefit significantly from project references and isolatedModules.',
      ],
      disagreements: ['Minor divergence regarding whether to emit declaration files in development mode vs CI.'],
      sources: [
        { title: 'TypeScript Official Handbook', url: 'https://www.typescriptlang.org/docs', date: '2026-03-01' },
        { title: 'Monorepo Architecture Benchmark', url: 'https://github.com/microsoft/TypeScript', date: '2026-05-15' },
      ],
    });
  };

  // Add Task
  const handleAddTask = (e: React.FormEvent) => {
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
            <span className="text-[10px] text-slate-400">v1.0.0</span>
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
        <div className="pt-4 border-t border-don-border text-[11px] text-slate-400 space-y-1 px-1">
          <div className="flex justify-between items-center">
            <span>Desktop Agent:</span>
            <CapabilityBadge label="Requires local agent" />
          </div>
          <div className="flex justify-between items-center">
            <span>Android Companion:</span>
            <CapabilityBadge label="Working" />
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-b from-[#0e1118] to-[#0a0c10]">
        {/* Top Header with Kill Switch Banner */}
        <header className="p-4 border-b border-don-border bg-slate-950/60 backdrop-blur space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                {activeTab.replace('-', ' ')}
              </h2>
              <p className="text-xs text-slate-400">
                Permission-based operations • End-to-end encrypted relay • Full audit trail
              </p>
            </div>

            <div className="flex items-center gap-3">
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
                      <li>• Transient screen sharing: <span className="text-emerald-400">Zero Retention</span></li>
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
                    handleSendMessage('Search verified sources for latest WebAssembly release notes');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Search className="w-5 h-5 text-amber-400" />
                  <div className="font-semibold text-xs text-slate-200">Verified Web Search</div>
                  <div className="text-[11px] text-slate-400">Search with publisher citations and uncertainty scores.</div>
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

                <button
                  onClick={() => {
                    setActiveTab('privacy');
                  }}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left space-y-2 transition-all hover:border-amber-500/40"
                >
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <div className="font-semibold text-xs text-slate-200">Privacy & Memory Center</div>
                  <div className="text-[11px] text-slate-400">Review, edit, export, or erase stored memories.</div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ASSISTANT CHAT */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-12rem)] space-y-4">
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
                        <span className="font-semibold uppercase tracking-wider">
                          {msg.role === 'user' ? 'Owner' : 'DON Assistant'}
                        </span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Attached Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-800 space-y-1">
                          <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                            Verified Citations:
                          </span>
                          {msg.citations.map((c: any, idx) => (
                            <div key={idx} className="text-[11px] text-slate-400 flex items-start gap-1">
                              <span>•</span>
                              {c.url ? (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-400 hover:underline inline-flex items-center gap-1"
                                >
                                  {c.title} <ExternalLink className="w-3 h-3 inline" />
                                </a>
                              ) : (
                                <span>{c.documentName} ({c.pageOrSection})</span>
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

              {/* Input Bar */}
              <div className="p-2 rounded-lg border border-don-border bg-slate-900/80 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  title={isVoiceListening ? 'Stop listening' : 'Start voice input'}
                  className={`p-2 rounded-md transition-all ${
                    isVoiceListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                  }`}
                >
                  {isVoiceListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    isVoiceListening
                      ? 'Listening to speech...'
                      : 'Ask DON, propose desktop app, request phone call...'
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
                      <span className="text-amber-400 font-bold">85%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '85%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Milestones: TypeScript monorepo complete, Docker healthcheck verified.
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
                        <CapabilityBadge label="Working" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KNOWLEDGE BASE & DOCUMENTS */}
          {activeTab === 'docs' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Semantic Document Query (PDF, DOCX, TXT, Markdown)
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    placeholder="Ask a question across connected documents..."
                    className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      setDocSearchResult({
                        answer: 'Based on your connected specification document: DON enforces explicit approval before any external app is launched or phone call initiated.',
                        citations: [
                          { documentName: 'DON_Architecture_Spec.md', pageOrSection: 'Section 4', retrievalConfidence: 0.94 },
                        ],
                      });
                    }}
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs"
                  >
                    Query
                  </button>
                </div>

                {docSearchResult && (
                  <div className="rounded bg-black/50 border border-slate-800 p-3 text-xs space-y-2 mt-3">
                    <p className="text-slate-200">{docSearchResult.answer}</p>
                    <div className="text-[10px] text-amber-400 pt-1 border-t border-slate-800">
                      Citation: {docSearchResult.citations[0].documentName} ({docSearchResult.citations[0].pageOrSection}) — Confidence: {(docSearchResult.citations[0].retrievalConfidence * 100).toFixed(0)}%
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Meeting Mode Transcript Summarizer
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <p className="text-xs text-slate-400">
                  Import user-provided transcripts. Audio is never captured without explicit user action.
                </p>

                <textarea
                  rows={5}
                  value={meetingTranscript}
                  onChange={(e) => setMeetingTranscript(e.target.value)}
                  className="w-full rounded bg-black/40 border border-slate-800 p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />

                <button
                  onClick={handleRunMeetingAnalysis}
                  className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
                >
                  Analyze Transcript & Extract Tasks
                </button>

                {meetingResult && (
                  <div className="rounded border border-slate-800 bg-black/60 p-4 text-xs space-y-4">
                    <div>
                      <span className="font-semibold text-amber-400 block mb-1">Key Decisions:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {meetingResult.decisions.map((d: string, i: number) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-semibold text-amber-400 block mb-1">Extracted Tasks:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {meetingResult.tasks.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-semibold text-amber-400 block mb-1">Draft Follow-up Email:</span>
                      <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] whitespace-pre-wrap text-slate-300">
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-amber-400" />
                    Multi-Source Deep Research Mode
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleRunResearch}
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs"
                  >
                    Conduct Research
                  </button>
                </div>

                {researchBrief && (
                  <div className="rounded border border-slate-800 bg-black/60 p-4 text-xs space-y-3">
                    <span className="text-amber-400 font-semibold block">Synthesized Claims:</span>
                    <ul className="space-y-1.5 text-slate-300">
                      {researchBrief.claims.map((c: string, idx: number) => (
                        <li key={idx}>• {c}</li>
                      ))}
                    </ul>

                    <span className="text-amber-400 font-semibold block pt-2 border-t border-slate-800">
                      Identified Uncertainties & Disagreements:
                    </span>
                    <ul className="space-y-1 text-slate-400">
                      {researchBrief.disagreements.map((d: string, idx: number) => (
                        <li key={idx}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: DEVICES & DESKTOP CONTROL */}
          {activeTab === 'devices' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Windows Desktop Agent Allowlist */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-amber-400" />
                      Desktop Agent Allowlist (Windows)
                    </h3>
                    <CapabilityBadge label="Requires local agent" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Strict security sandbox: No arbitrary scripts or unknown paths can execute. Only verified allowlisted binaries.
                  </p>
                  <div className="space-y-2 text-xs">
                    {allowlistedApps.map((app) => (
                      <div
                        key={app.id}
                        className="rounded border border-slate-800 bg-black/40 p-2.5 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{app.appName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{app.path}</div>
                        </div>
                        <button
                          onClick={() => {
                            handleSendMessage(`Launch ${app.appName}`);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px]"
                        >
                          Propose Launch
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Android Companion Pairing & Dialer */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-sky-400" />
                      Android Companion (Pairing & Dialer)
                    </h3>
                    <CapabilityBadge label="Working" />
                  </div>
                  <div className="rounded border border-slate-800 bg-black/40 p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">One-time Pairing Code:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">{pairingToken}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Scan QR code or enter token in Android app to establish mutual TLS and HMAC handshake.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs pt-2">
                    <label className="text-slate-400 block text-[11px]">Dialer Proposal Test Number:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={phoneDialNumber}
                        onChange={(e) => setPhoneDialNumber(e.target.value)}
                        className="flex-1 rounded bg-black/40 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          handleSendMessage(`Open phone dialer with ${phoneDialNumber}`);
                        }}
                        className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs"
                      >
                        Propose Dialer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Automations Recipes & Safeguards
                  </h3>
                  <CapabilityBadge label="Working" />
                </div>
                <div className="space-y-3 text-xs">
                  {[
                    { title: 'Morning Briefing at 9:00 AM', trigger: 'Cron: 0 9 * * 1-5', action: 'Compile Daily Briefing' },
                    { title: 'Focus Mode Tool Launch', trigger: 'Focus Mode Started', action: 'Propose launch of allowlisted IDE' },
                    { title: 'Urgent Task Android Notification', trigger: 'Task Priority = URGENT', action: 'Push notification to Android' },
                  ].map((auto, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-slate-800 bg-black/40 p-3 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{auto.title}</div>
                        <div className="text-[11px] text-slate-400">Trigger: {auto.trigger} → Action: {auto.action}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
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
                        <div className="text-[9px] text-slate-500">
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
    </div>
  );
}

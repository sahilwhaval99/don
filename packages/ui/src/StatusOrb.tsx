import React from 'react';
import { AssistantStatus } from '@don/shared';

export interface StatusOrbProps {
  status: AssistantStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<
  AssistantStatus,
  { label: string; ringColor: string; glowColor: string; pulse: boolean }
> = {
  offline: {
    label: 'Offline',
    ringColor: 'border-slate-500 bg-slate-700',
    glowColor: 'shadow-slate-500/20',
    pulse: false,
  },
  ready: {
    label: 'Ready',
    ringColor: 'border-emerald-500 bg-emerald-600',
    glowColor: 'shadow-emerald-500/30',
    pulse: false,
  },
  listening: {
    label: 'Listening',
    ringColor: 'border-cyan-400 bg-cyan-500',
    glowColor: 'shadow-cyan-400/50',
    pulse: true,
  },
  thinking: {
    label: 'Thinking',
    ringColor: 'border-amber-400 bg-amber-500',
    glowColor: 'shadow-amber-500/50',
    pulse: true,
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    ringColor: 'border-rose-400 bg-rose-500',
    glowColor: 'shadow-rose-500/60',
    pulse: true,
  },
  running: {
    label: 'Executing Action',
    ringColor: 'border-purple-400 bg-purple-500',
    glowColor: 'shadow-purple-500/40',
    pulse: true,
  },
  complete: {
    label: 'Operation Complete',
    ringColor: 'border-emerald-400 bg-emerald-500',
    glowColor: 'shadow-emerald-400/40',
    pulse: false,
  },
  error: {
    label: 'Attention Required',
    ringColor: 'border-red-500 bg-red-600',
    glowColor: 'shadow-red-500/50',
    pulse: false,
  },
};

export const StatusOrb: React.FC<StatusOrbProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const current = statusConfig[status] || statusConfig.ready;
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  }[size];

  return (
    <div className="inline-flex items-center gap-2" role="status" aria-label={`Assistant status: ${current.label}`}>
      <span className="relative flex items-center justify-center">
        {current.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${current.ringColor}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full border-2 shadow-lg transition-all duration-300 ${sizeClasses} ${current.ringColor} ${current.glowColor}`}
        />
      </span>
      {showLabel && (
        <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
          {current.label}
        </span>
      )}
    </div>
  );
};

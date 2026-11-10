import React from 'react';
import { CapabilityLabel } from '@don/shared';

export interface CapabilityBadgeProps {
  label: CapabilityLabel;
  className?: string;
}

const badgeStyles: Record<CapabilityLabel, string> = {
  Working: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Requires permission': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Requires local agent': 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  Simulated: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  Unavailable: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export const CapabilityBadge: React.FC<CapabilityBadgeProps> = ({
  label,
  className = '',
}) => {
  const style = badgeStyles[label] || badgeStyles.Unavailable;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
};

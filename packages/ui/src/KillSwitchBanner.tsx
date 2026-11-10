import React from 'react';

export interface KillSwitchBannerProps {
  isActivated: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  disabled?: boolean;
}

export const KillSwitchBanner: React.FC<KillSwitchBannerProps> = ({
  isActivated,
  onActivate,
  onDeactivate,
  disabled = false,
}) => {
  return (
    <div
      className={`w-full px-4 py-2.5 rounded-lg border flex items-center justify-between transition-colors ${
        isActivated
          ? 'bg-rose-950/60 border-rose-500/80 text-rose-200'
          : 'bg-slate-900/80 border-slate-800 text-slate-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isActivated ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
          }`}
        />
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isActivated ? 'Emergency Kill Switch Active' : 'Automations Normal'}
          </span>
          <span className="text-[11px] text-slate-400">
            {isActivated
              ? 'All background automations, scheduled routines, and agent proposals are paused.'
              : 'Automations running according to permission rules.'}
          </span>
        </div>
      </div>

      <div>
        {isActivated ? (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={disabled}
            className="px-3 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Resume Automations
          </button>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            disabled={disabled}
            className="px-3 py-1 text-xs font-semibold rounded bg-rose-600/90 hover:bg-rose-600 text-white shadow-sm hover:shadow-rose-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            Stop all automations
          </button>
        )}
      </div>
    </div>
  );
};

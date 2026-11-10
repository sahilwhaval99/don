import React from 'react';
import { ToolCallProposal } from '@don/shared';

export interface ApprovalCardProps {
  proposal: ToolCallProposal;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  isProcessing?: boolean;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  proposal,
  onApprove,
  onDeny,
  isProcessing = false,
}) => {
  const { consequence, toolName, parameters, id, status } = proposal;
  const isPending = status === 'PENDING';

  const riskBadgeColor = {
    LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    CRITICAL: 'text-rose-400 bg-rose-500/20 border-rose-500/40 font-bold',
  }[consequence.riskLevel];

  return (
    <div className="w-full rounded-lg border border-amber-500/40 bg-slate-900/90 p-4 shadow-lg backdrop-blur space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h4 className="text-sm font-semibold text-amber-200">
            Permission Required: <code className="text-amber-400">{toolName}</code>
          </h4>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${riskBadgeColor}`}>
          Risk: {consequence.riskLevel}
        </span>
      </div>

      <div className="rounded bg-black/40 p-3 border border-slate-800 text-xs space-y-2">
        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
          <span className="text-slate-400">Target:</span>
          <span className="font-mono text-slate-200 break-all">{consequence.target}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
          <span className="text-slate-400">Consequences:</span>
          <span className="text-slate-300 text-right">{consequence.description}</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Reversible: {consequence.isReversible ? 'Yes' : 'No'}</span>
          {consequence.requiresLocalAgent && <span>Requires Windows Agent</span>}
          {consequence.requiresAndroidCompanion && <span>Requires Android Phone</span>}
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => onDeny(id)}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 transition-colors"
          >
            Deny Action
          </button>
          <button
            type="button"
            onClick={() => onApprove(id)}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-500/20 transition-all focus:ring-2 focus:ring-amber-500"
          >
            Approve & Execute
          </button>
        </div>
      ) : (
        <div className="text-right text-xs font-medium text-slate-400">
          Status: <span className="uppercase text-slate-200">{status}</span>
        </div>
      )}
    </div>
  );
};

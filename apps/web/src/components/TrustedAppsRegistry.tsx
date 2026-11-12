'use client';

import React, { useMemo, useState } from 'react';
import { Laptop, Search, ShieldCheck, Zap, Play, RefreshCw } from 'lucide-react';
import { CapabilityBadge } from '@don/ui';

export interface TrustedAppEntry {
  id: string;
  appName: string;
  executablePath: string;
  source?: string;
  trusted: boolean;
}

interface TrustedAppsRegistryProps {
  apps: TrustedAppEntry[];
  trustedFastLaunch: boolean;
  isApiConnected: boolean;
  onToggleFastLaunch: (enabled: boolean) => void;
  onToggleAppTrusted: (appId: string, trusted: boolean) => void;
  onLaunchApp: (app: TrustedAppEntry) => void;
  onRefreshApps?: () => void;
}

export function TrustedAppsRegistry({
  apps,
  trustedFastLaunch,
  isApiConnected,
  onToggleFastLaunch,
  onToggleAppTrusted,
  onLaunchApp,
  onRefreshApps,
}: TrustedAppsRegistryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'trusted'>('all');

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return apps.filter((app) => {
      if (filterMode === 'trusted' && !app.trusted) return false;
      if (!q) return true;
      return (
        app.appName.toLowerCase().includes(q) ||
        app.executablePath.toLowerCase().includes(q)
      );
    });
  }, [apps, searchQuery, filterMode]);

  const trustedCount = apps.filter((a) => a.trusted).length;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Laptop className="w-4 h-4 text-cyan-400" />
            Trusted Apps Registry & Fast-Launch Policy
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Scanned Windows Start Menu & utility registry. Only verified registry executables can run—zero arbitrary shell RCE.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshApps && (
            <button
              type="button"
              onClick={onRefreshApps}
              className="px-2.5 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
              title="Rescan installed Windows apps"
            >
              <RefreshCw className="w-3 h-3" /> Rescan
            </button>
          )}
          <CapabilityBadge label={isApiConnected ? 'Working' : 'Requires local agent'} />
        </div>
      </div>

      {/* Trusted Fast-Launch Policy Toggle */}
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Trusted Fast-Launch Mode
          </div>
          <p className="text-[11px] text-slate-400">
            When enabled, apps marked <span className="text-emerald-400 font-medium">Trusted</span> launch immediately with an{' '}
            <code className="text-cyan-300">AUTO_APPROVED_TRUSTED</code> audit entry instead of blocking for manual confirmation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleFastLaunch(!trustedFastLaunch)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            trustedFastLaunch
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          {trustedFastLaunch ? 'Fast-Launch: ENABLED' : 'Fast-Launch: OFF (Confirm All)'}
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed apps (e.g. Edge, Spotify, VS Code, Calculator)..."
            className="w-full rounded bg-black/50 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          />
        </div>
        <div className="flex rounded border border-slate-800 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 ${
              filterMode === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'bg-black/40 text-slate-400'
            }`}
          >
            All ({apps.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('trusted')}
            className={`px-3 py-1.5 ${
              filterMode === 'trusted' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-black/40 text-slate-400'
            }`}
          >
            Trusted ({trustedCount})
          </button>
        </div>
      </div>

      {/* Registry List */}
      <div className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
        {filteredApps.length === 0 ? (
          <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded">
            No matching applications in Trusted Registry.
          </div>
        ) : (
          filteredApps.map((app) => (
            <div
              key={app.id}
              className="rounded border border-slate-800 bg-black/40 p-3 flex flex-wrap justify-between items-center gap-2 hover:border-slate-700 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{app.appName}</span>
                  {app.source && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                      {app.source}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{app.executablePath}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAppTrusted(app.id, !app.trusted)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                    app.trusted
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {app.trusted ? 'Trusted' : 'Require Ask'}
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchApp(app)}
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  {trustedFastLaunch && app.trusted ? 'Fast Launch' : 'Propose'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

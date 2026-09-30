import React, { useState } from 'react';

// Optional fallback to mock_state.json when standalone
let mockAlerts = [];
try {
  // eslint-disable-next-line
  const mockState = require('../../../contracts/mock_state.json');
  mockAlerts = mockState.alerts || [];
} catch (e) {
  // Graceful fallback
}

const LEVEL_CONFIG = {
  critical: {
    icon: '🚨',
    label: 'CRITICAL',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    card: 'border-rose-500/30 bg-rose-950/20',
    dot: 'bg-rose-500',
  },
  warning: {
    icon: '⚠️',
    label: 'WARNING',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    card: 'border-amber-500/30 bg-amber-950/20',
    dot: 'bg-amber-500',
  },
  info: {
    icon: 'ℹ️',
    label: 'INFO',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    card: 'border-sky-500/30 bg-sky-950/20',
    dot: 'bg-sky-500',
  },
};

/**
 * AlertsPanel renders operational crisis alerts sorted newest first,
 * with level icons, timestamps, filtering tabs, and graceful empty states.
 */
export default function AlertsPanel({
  alerts = null,
}) {
  const [filterLevel, setFilterLevel] = useState('ALL');

  const alertList = alerts !== null ? alerts : mockAlerts;

  // Sort newest first: by at_min descending
  const sortedAlerts = [...alertList].sort((a, b) => (b.at_min ?? 0) - (a.at_min ?? 0));

  // Filter alerts by level
  const filteredAlerts = sortedAlerts.filter((alt) => {
    if (filterLevel === 'ALL') return true;
    return (alt.level || '').toLowerCase() === filterLevel.toLowerCase();
  });

  const criticalCount = alertList.filter((a) => (a.level || '').toLowerCase() === 'critical').length;
  const warningCount = alertList.filter((a) => (a.level || '').toLowerCase() === 'warning').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>🔔</span> System Alerts
            {criticalCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                {criticalCount} Critical
              </span>
            )}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Operational warnings, resource failures, and preemption logs
          </p>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setFilterLevel('ALL')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filterLevel === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            All ({alertList.length})
          </button>
          <button
            onClick={() => setFilterLevel('CRITICAL')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filterLevel === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400 hover:text-rose-200 hover:bg-slate-800/60'
            }`}
          >
            Critical ({criticalCount})
          </button>
          <button
            onClick={() => setFilterLevel('WARNING')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filterLevel === 'WARNING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400 hover:text-amber-200 hover:bg-slate-800/60'
            }`}
          >
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilterLevel('INFO')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filterLevel === 'INFO'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-sky-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Info
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="p-3 overflow-y-auto space-y-2 flex-1 max-h-[260px]">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-xl mb-2 text-slate-400">
              🛡️
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No Alerts Recorded</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {filterLevel === 'ALL'
                ? 'No active warnings or critical events. Autonomous dispatch operations are functioning normally.'
                : `No alerts found for level "${filterLevel}".`}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const levelInfo = LEVEL_CONFIG[alert.level?.toLowerCase()] || LEVEL_CONFIG.info;

            return (
              <div
                key={alert.id || `${alert.at_min}-${alert.text}`}
                className={`p-3.5 rounded-xl border transition-all ${levelInfo.card} shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0 mt-0.5" role="img" aria-label={levelInfo.label}>
                    {levelInfo.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border tracking-wider ${levelInfo.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${levelInfo.dot}`} />
                          {levelInfo.label}
                        </span>
                        {alert.id && (
                          <span className="text-[10px] font-mono text-slate-500">
                            #{alert.id}
                          </span>
                        )}
                      </div>

                      {/* Timestamp Tag */}
                      <span className="text-xs font-mono font-medium text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                        ⏱️ t={alert.at_min ?? 0}m
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-200 leading-relaxed">
                      {alert.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import React from 'react';

const CHANGE_CONFIG = {
  added: {
    label: 'ADDED',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: '➕',
  },
  removed: {
    label: 'REMOVED',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: '➖',
  },
  reassigned: {
    label: 'REASSIGNED',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: '🔁',
  },
  eta_changed: {
    label: 'ETA SHIFT',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: '⏱️',
  },
};

/**
 * PlanDiff displays dispatch plan version differences,
 * showing added, removed, reassigned, and ETA changes with explicit reasons
 * alongside before/after operational metrics.
 */
export default function PlanDiff({
  diff = null,
  state = null,
  metricsBefore = null,
  metricsAfter = null,
}) {
  // Extract diff from prop or state
  const activeDiff = (state?.approval?.status === 'pending' ? state?.approval?.diff : null) || diff || state?.latest_diff || null;

  // Extract before and after metrics
  const before = metricsBefore || (state?.plan_history?.length > 0 ? state.plan_history[state.plan_history.length - 1].metrics : null) || state?.current_plan?.metrics;
  const after = metricsAfter || state?.current_plan?.metrics;

  const changes = activeDiff?.changes || [];
  const fromVersion = activeDiff?.from_version ?? (state?.current_plan ? Math.max(0, state.current_plan.version - 1) : 0);
  const toVersion = activeDiff?.to_version ?? (state?.current_plan?.version ?? 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>⚖️</span> Plan Diff
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Comparing <span className="text-slate-300 font-bold">v{fromVersion}</span> &rarr; <span className="text-indigo-400 font-bold">v{toVersion}</span>
            {' '}({changes.length} change{changes.length === 1 ? '' : 's'})
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            v{toVersion}
          </span>
        </div>
      </div>

      {/* Metrics Before & After Comparison Strip */}
      {(before || after) && (
        <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-5 gap-1.5 text-center text-xs">
          <div className="p-1 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Avg ETA</span>
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              {before?.avg_eta_min?.toFixed(1) ?? '--'}m &rarr; {after?.avg_eta_min?.toFixed(1) ?? '--'}m
            </span>
          </div>

          <div className="p-1 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Max ETA</span>
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              {before?.max_eta_min?.toFixed(1) ?? '--'}m &rarr; {after?.max_eta_min?.toFixed(1) ?? '--'}m
            </span>
          </div>

          <div className="p-1 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Coverage</span>
            <span className="font-mono text-[11px] font-semibold text-emerald-400">
              {before?.coverage_pct?.toFixed(0) ?? '--'}% &rarr; {after?.coverage_pct?.toFixed(0) ?? '--'}%
            </span>
          </div>

          <div className="p-1 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Utilization</span>
            <span className="font-mono text-[11px] font-semibold text-indigo-400">
              {before?.utilization_pct?.toFixed(0) ?? '--'}% &rarr; {after?.utilization_pct?.toFixed(0) ?? '--'}%
            </span>
          </div>

          <div className="p-1 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Unresolved</span>
            <span className="font-mono text-[11px] font-semibold text-rose-400">
              {before?.unresolved_count ?? 0} &rarr; {after?.unresolved_count ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto max-h-[240px] p-3 space-y-2">
        {changes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg mb-2 text-slate-500">
              ✓
            </div>
            <p className="text-sm font-medium text-slate-300">No Plan Discrepancies</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Current plan v{toVersion} is fully converged and identical to the previous baseline state.
            </p>
          </div>
        ) : (
          changes.map((change, idx) => {
            const config = CHANGE_CONFIG[change.kind] || {
              label: change.kind.toUpperCase(),
              badge: 'bg-slate-700 text-slate-300 border-slate-600',
              icon: '•',
            };

            return (
              <div
                key={`diff-${change.resource_id}-${idx}`}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col gap-1.5 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {change.resource_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${config.badge}`}>
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                    </span>
                  </div>

                  <div className="font-mono text-slate-400">
                    {change.old_incident_id && change.new_incident_id ? (
                      <span>
                        <span className="text-slate-300">{change.old_incident_id}</span>
                        {' '}&rarr;{' '}
                        <span className="text-indigo-400 font-semibold">{change.new_incident_id}</span>
                      </span>
                    ) : change.new_incident_id ? (
                      <span className="text-emerald-400 font-semibold">&rarr; {change.new_incident_id}</span>
                    ) : change.old_incident_id ? (
                      <span className="text-rose-400 font-semibold">&times; {change.old_incident_id}</span>
                    ) : null}
                  </div>
                </div>

                {/* Reason description */}
                {change.reason && (
                  <p className="text-slate-300 font-sans leading-relaxed pl-1 border-l-2 border-slate-700">
                    {change.reason}
                  </p>
                )}

                {/* ETA change indicator */}
                {(change.old_eta_min !== null || change.new_eta_min !== null) && (
                  <div className="text-[11px] font-mono text-slate-400 pl-1 flex items-center gap-2">
                    <span>ETA:</span>
                    <span>{change.old_eta_min !== null ? `${change.old_eta_min.toFixed(1)}m` : '--'}</span>
                    <span>&rarr;</span>
                    <span className="text-slate-200 font-semibold">{change.new_eta_min !== null ? `${change.new_eta_min.toFixed(1)}m` : '--'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import React from 'react';

/**
 * CrisisScoreboard: Operational metrics with trend indicators (↑, ↓, →)
 * Displays executive summary of real-time operational posture and efficiency.
 */
export default function CrisisScoreboard({ state }) {
  const incidents = state?.incidents || [];
  const resources = state?.resources || [];
  const currentPlan = state?.current_plan || {};
  const metrics = currentPlan.metrics || {};
  const approval = state?.approval;

  const activeIncidentsCount = incidents.filter((i) => i.status !== 'resolved').length;
  const criticalCount = incidents.filter((i) => i.severity >= 4 && i.status !== 'resolved').length;
  const utilization = metrics.utilization_pct != null ? Number(metrics.utilization_pct) : 0;
  const avgEta = metrics.avg_eta_min != null ? Number(metrics.avg_eta_min) : 0;

  // Derive safety / containment index (0 to 100)
  const containmentIndex = Math.max(
    10,
    Math.min(
      100,
      100 -
        criticalCount * 18 -
        (metrics.unresolved_count || 0) * 10 -
        (approval?.status === 'pending' ? 15 : 0)
    )
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col w-full min-w-0">
      {/* Header */}
      <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-xs font-bold tracking-tight text-white uppercase truncate">
            Crisis Operational Scoreboard
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">
          Clock: <strong className="text-indigo-400">t={state?.clock_min ?? 0}m</strong>
        </span>
      </div>

      {/* Grid of 5 Key Scoreboard Cards: responsive 2 -> 3 -> 5 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-2.5 text-center">
        {/* Active Incidents */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 truncate">
            Active Incidents
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1 min-w-0">
            <span className="text-lg sm:text-xl font-bold font-mono text-white">
              {activeIncidentsCount}
            </span>
            <span
              className={`text-xs font-bold shrink-0 ${
                activeIncidentsCount > 1 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {activeIncidentsCount > 1 ? '↑ High' : '→ Steady'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate">
            {criticalCount} Critical
          </span>
        </div>

        {/* Fleet Utilization */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 truncate">
            Fleet Utilization
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1 min-w-0">
            <span className="text-lg sm:text-xl font-bold font-mono text-purple-400">
              {utilization.toFixed(0)}%
            </span>
            <span
              className={`text-xs font-bold shrink-0 ${
                utilization > 70 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {utilization > 70 ? '↑ High' : '→ Normal'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate">
            {resources.filter((r) => r.status === 'available').length} Available
          </span>
        </div>

        {/* Mean Response ETA */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 truncate">
            Mean Response ETA
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1 min-w-0">
            <span className="text-lg sm:text-xl font-bold font-mono text-sky-400">
              {avgEta > 0 ? `${avgEta.toFixed(1)}m` : '--'}
            </span>
            <span
              className={`text-xs font-bold shrink-0 ${
                avgEta > 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {avgEta > 5 ? '↑ Delays' : '↓ Rapid'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate">
            Target &le; 6.0m
          </span>
        </div>

        {/* Containment Index */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 truncate">
            Containment Score
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1 min-w-0">
            <span
              className={`text-lg sm:text-xl font-bold font-mono ${
                containmentIndex >= 70
                  ? 'text-emerald-400'
                  : containmentIndex >= 45
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {containmentIndex}%
            </span>
            <span
              className={`text-xs font-bold shrink-0 ${
                containmentIndex >= 70 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {containmentIndex >= 70 ? '↑ Secure' : '↓ Danger'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate">
            Public Safety Index
          </span>
        </div>

        {/* Governance / Human Gate */}
        <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 truncate">
            Human Gate
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1 min-w-0">
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded border truncate ${
                approval?.status === 'pending'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {approval?.status === 'pending' ? 'APPROVAL REQUIRED' : 'CLEAR'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate">
            Safety Override
          </span>
        </div>
      </div>
    </div>
  );
}

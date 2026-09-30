import React, { useState } from 'react';

/**
 * Header with:
 * - Feature 9: Crisis Escalation Level 1-5 with transparent rationale
 * - Feature 10: Presentation / Judge Mode toggle
 */
export default function Header({ state, isJudgeMode, onToggleJudgeMode }) {
  const [showLevelDetails, setShowLevelDetails] = useState(false);

  // Compute Crisis Escalation Level (1 to 5)
  const incidents = state?.incidents || [];
  const resources = state?.resources || [];
  const approval = state?.approval;

  const maxSeverity = incidents.reduce((max, i) => Math.max(max, i.severity || 1), 1);
  const criticalCount = incidents.filter((i) => (i.severity || 1) >= 4 && i.status !== 'resolved').length;
  const failedCount = resources.filter((r) => r.status === 'unavailable').length;

  let crisisLevel = 1;
  let levelLabel = 'Routine / Nominal';
  let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  if (maxSeverity >= 5 || criticalCount >= 2 || (failedCount >= 2 && criticalCount >= 1)) {
    crisisLevel = 5;
    levelLabel = 'Catastrophic Emergency';
    badgeColor = 'bg-rose-600/30 text-rose-300 border-rose-500 ring-2 ring-rose-500/40 animate-pulse';
  } else if (maxSeverity === 4 || criticalCount === 1 || failedCount >= 1) {
    crisisLevel = 4;
    levelLabel = 'Severe Incident Surge';
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (maxSeverity === 3 || approval?.required) {
    crisisLevel = 3;
    levelLabel = 'Elevated Tactical Response';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else if (maxSeverity === 2 || incidents.length > 1) {
    crisisLevel = 2;
    levelLabel = 'Advisory Dispatch';
    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2 shadow-lg flex justify-between items-center flex-wrap gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚨</span>
          <h1 className="text-lg font-black tracking-tight">Crisis Command</h1>
          <span className="text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
            Autonomous Dispatch &bull; Round 2
          </span>
        </div>

        {/* Feature 9: Crisis Escalation Level 1-5 */}
        <div className="relative">
          <button
            onClick={() => setShowLevelDetails(!showLevelDetails)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${badgeColor}`}
            title="Click to view crisis escalation rationale"
          >
            <span>⚠️</span>
            <span>CRISIS LEVEL {crisisLevel}: {levelLabel}</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </button>

          {showLevelDetails && (
            <div className="absolute left-0 mt-1.5 z-50 w-72 bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs text-slate-200 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="font-bold text-white uppercase text-[11px]">
                  Crisis Escalation Rationale
                </span>
                <span className="font-mono text-indigo-400 font-bold">
                  Scale 1&ndash;5
                </span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li>&bull; Max Active Severity: <strong className="text-rose-400">{maxSeverity}/5</strong></li>
                <li>&bull; Critical Incidents (&ge;4): <strong className="text-white">{criticalCount}</strong></li>
                <li>&bull; Failed Apparatus / Offline Units: <strong className="text-amber-400">{failedCount}</strong></li>
                <li>&bull; Human Approval Gate: <strong className="text-white">{approval?.required ? 'Triggered' : 'Nominal'}</strong></li>
              </ul>
              <div className="pt-1 text-[10px] text-slate-500 italic border-t border-slate-800">
                Escalation levels automatically govern dispatch priority tiers and strict human-in-the-loop safeguards.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Feature 10: Presentation / Judge Mode Toggle */}
        <button
          onClick={onToggleJudgeMode}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
            isJudgeMode
              ? 'bg-purple-600 text-white border-purple-400 shadow-purple-500/20'
              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
          }`}
        >
          <span>{isJudgeMode ? '✨' : '👁️'}</span>
          <span>{isJudgeMode ? 'Exit Judge Mode' : 'Presentation / Judge Mode'}</span>
        </button>

        <div className="text-xs font-medium text-slate-400 font-mono hidden sm:inline">
          Team Neural Ninjas
        </div>
      </div>
    </header>
  );
}

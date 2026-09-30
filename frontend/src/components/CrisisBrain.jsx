import React, { useState } from 'react';
import { postJson } from '../api';

/**
 * CrisisBrain: Executive AI Situation Summary & Brief Generator
 * Displays live crisis state synthesis, critical bottleneck detection,
 * and one-click executive situation briefing.
 */
export default function CrisisBrain({ state }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Compute live fast metrics directly from state
  const incidents = state?.incidents || [];
  const resources = state?.resources || [];
  const currentPlan = state?.current_plan || {};
  const approval = state?.approval;

  const criticalIncidents = incidents.filter(
    (i) => i.severity >= 4 || (i.tier || '').toLowerCase() === 'critical'
  );
  const unresolvedIncidents = incidents.filter((i) => i.status !== 'resolved');
  const failedResources = resources.filter((r) => r.status === 'unavailable');

  // Find most urgent incident
  const sortedIncidents = [...incidents].sort((a, b) => (b.severity || 0) - (a.severity || 0));
  const mostUrgent = sortedIncidents[0];

  const handleGenerateBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson('/situation-brief', {});
      setBrief(data);
    } catch (err) {
      setError(`Brief generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col w-full min-w-0">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🧠</span>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 truncate">
              Crisis Brain &bull; AI Synthesis
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              Multi-agent situational awareness &amp; executive briefing
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerateBrief}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-2.5 py-1 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <span>{loading ? '⚡' : '✨'}</span>
          <span>{loading ? 'Synthesizing...' : 'Generate Brief'}</span>
        </button>
      </div>

      {/* Synthesis Metric Pills: 2 columns in sidebars, 4 columns on wide displays */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/60 border-b border-slate-800/80">
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
            Most Urgent Threat
          </span>
          <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono truncate mt-1">
            {mostUrgent ? `${mostUrgent.id} (${mostUrgent.type})` : 'Nominal'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
            Active Bottleneck
          </span>
          <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono truncate mt-1">
            {failedResources.length > 0
              ? `${failedResources.map((r) => r.id).join(', ')} Offline`
              : (currentPlan.unmet && currentPlan.unmet.length > 0)
              ? `${currentPlan.unmet.length} Unmet Demand`
              : 'Fleet Sufficient'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
            Human Approval Gate
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono mt-1 flex items-center gap-1 truncate">
            {approval?.required ? (
              <span className="text-rose-400 animate-pulse">Required ⚠️</span>
            ) : (
              <span className="text-emerald-400">Clear ✓</span>
            )}
          </span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
            Critical Unresolved
          </span>
          <span className="text-xs sm:text-sm font-bold text-indigo-400 font-mono mt-1 truncate">
            {criticalIncidents.length} of {unresolvedIncidents.length}
          </span>
        </div>
      </div>

      {/* Brief Output Area */}
      <div className="p-2.5 text-xs leading-relaxed space-y-2">
        {error && (
          <div className="p-2 rounded bg-rose-950/50 border border-rose-800 text-rose-300">
            {error}
          </div>
        )}

        {brief ? (
          <div className="bg-slate-950/80 border border-indigo-500/30 rounded-lg p-3 space-y-2 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1 text-[11px]">
                <span>📄</span> Executive Situation Brief
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {brief.used_llm ? 'AI Generated (Gemini)' : 'Deterministic Grounded Engine'}
              </span>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed font-sans">
              {brief.narrative}
            </p>
            {brief.proposed_action && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-amber-300 flex items-start gap-1.5">
                <span>🎯</span>
                <div>
                  <strong>Recommended Next Action:</strong> {brief.proposed_action}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-400 italic text-center py-3 bg-slate-950/30 rounded-lg border border-dashed border-slate-800">
            Click &quot;Generate Brief&quot; to synthesize current crisis threats, resource bottlenecks, and recommended tactical actions.
          </div>
        )}
      </div>
    </div>
  );
}

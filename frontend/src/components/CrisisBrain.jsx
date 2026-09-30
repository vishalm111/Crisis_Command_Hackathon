import React, { useState, useEffect } from 'react';
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              Crisis Brain &bull; AI Synthesis
            </h2>
            <p className="text-[11px] text-slate-400">
              Real-time multi-agent situational awareness & executive briefing
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerateBrief}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-3 py-1 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
        >
          <span>{loading ? '⚡' : '✨'}</span>
          <span>{loading ? 'Synthesizing...' : 'Generate Situation Brief'}</span>
        </button>
      </div>

      {/* Synthesis Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900/60 border-b border-slate-800/80">
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Most Urgent Threat
          </span>
          <span className="text-sm font-bold text-rose-400 font-mono flex items-center gap-1 mt-0.5">
            {mostUrgent ? `${mostUrgent.id} (${mostUrgent.type})` : 'Nominal'}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Active Bottleneck
          </span>
          <span className="text-sm font-bold text-amber-400 font-mono flex items-center gap-1 mt-0.5">
            {failedResources.length > 0
              ? `${failedResources.map((r) => r.id).join(', ')} Offline`
              : (currentPlan.unmet && currentPlan.unmet.length > 0)
              ? `${currentPlan.unmet.length} Unmet Demand`
              : 'Fleet Sufficient'}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Human Approval Gate
          </span>
          <span className="text-sm font-bold font-mono mt-0.5 flex items-center gap-1">
            {approval?.required ? (
              <span className="text-rose-400 animate-pulse">Required ⚠️</span>
            ) : (
              <span className="text-emerald-400">Clear ✓</span>
            )}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Critical Unresolved
          </span>
          <span className="text-sm font-bold text-indigo-400 font-mono mt-0.5">
            {criticalIncidents.length} of {unresolvedIncidents.length}
          </span>
        </div>
      </div>

      {/* Brief Output Area */}
      <div className="p-3 text-xs leading-relaxed space-y-2">
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
          <div className="text-slate-400 italic text-center py-2 bg-slate-950/30 rounded-lg border border-dashed border-slate-800">
            Click &quot;Generate Situation Brief&quot; to synthesize current crisis threats, resource bottlenecks, and recommended tactical actions.
          </div>
        )}
      </div>
    </div>
  );
}

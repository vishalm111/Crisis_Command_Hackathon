import React, { useState } from 'react';

// Optional fallback to mock_state.json when standalone
let mockExplanations = [];
let mockTraces = [];
try {
  // eslint-disable-next-line
  const mockState = require('../../../contracts/mock_state.json');
  mockExplanations = mockState.explanations || [];
  mockTraces = mockState.traces || [];
} catch (e) {
  // Graceful fallback
}

const TRIGGER_BADGES = {
  new_incident: { label: 'New Incident', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: '🚨' },
  resource_failure: { label: 'Resource Failure', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: '⚠️' },
  resource_restored: { label: 'Resource Restored', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40', icon: '🔄' },
  escalation: { label: 'Incident Escalation', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: '⚡' },
  time_advance: { label: 'Time Advance', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40', icon: '⏱️' },
  approval_decision: { label: 'Human Gate Decision', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: '🛡️' },
  what_if: { label: 'What-If Simulation', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: '🔮' },
};

/**
 * ExplanationLog renders system decision explanations newest first,
 * with expandable bullets revealing referenced raw audit decision traces.
 */
export default function ExplanationLog({
  explanations = null,
  traces = null,
  llmStatus = null,
}) {
  const [expandedBullets, setExpandedBullets] = useState({});
  const [filterTrigger, setFilterTrigger] = useState('ALL');

  const explanationList = explanations !== null ? explanations : mockExplanations;
  const traceList = traces !== null ? traces : mockTraces;

  // Show newest first (reverse order)
  const reversedExplanations = [...explanationList].reverse();

  // Filter by trigger
  const filteredExplanations = reversedExplanations.filter((exp) => {
    if (filterTrigger === 'ALL') return true;
    return (exp.trigger || '').toLowerCase() === filterTrigger.toLowerCase();
  });

  const toggleBullet = (key) => {
    setExpandedBullets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              <span>🧠</span> Decision Explanations
            </h2>
            {llmStatus && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                llmStatus === 'enabled_ok'
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : llmStatus === 'enabled_fallback'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  llmStatus === 'enabled_ok' ? 'bg-purple-400 animate-pulse' : llmStatus === 'enabled_fallback' ? 'bg-amber-400' : 'bg-slate-400'
                }`} />
                {llmStatus === 'enabled_ok' ? 'Grok Active' : llmStatus === 'enabled_fallback' ? 'Grok Fallback' : 'Offline / Rule Mode'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic and narrated rationale for plan updates, preemptions, and safety overrides
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          {['ALL', 'new_incident', 'resource_failure', 'escalation', 'approval_decision'].map((trig) => (
            <button
              key={trig}
              onClick={() => setFilterTrigger(trig)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterTrigger === trig
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {trig === 'ALL' ? 'All Triggers' : (TRIGGER_BADGES[trig]?.label || trig)}
            </button>
          ))}
        </div>
      </div>

      {/* Explanations Feed */}
      <div className="p-5 overflow-y-auto space-y-4 flex-1">
        {filteredExplanations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-xl mb-2 text-slate-400">
              💡
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No Explanations Logged</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {filterTrigger === 'ALL'
                ? 'No orchestrator actions or reallocations have occurred yet. Explanations will appear here as incidents and resource events occur.'
                : `No explanations recorded for trigger type "${filterTrigger}".`}
            </p>
          </div>
        ) : (
          filteredExplanations.map((exp, expIdx) => {
            const trigInfo = TRIGGER_BADGES[exp.trigger] || {
              label: exp.trigger || 'Event',
              color: 'bg-slate-800 text-slate-300 border-slate-700',
              icon: '📌',
            };

            return (
              <div
                key={exp.id || `exp-${expIdx}`}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-md"
              >
                {/* Header row: ID, Trigger Badge */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {exp.id || `#${expIdx + 1}`}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wide ${trigInfo.color}`}>
                      <span>{trigInfo.icon}</span>
                      <span>{trigInfo.label.toUpperCase()}</span>
                    </span>
                  </div>

                  {exp.trace_refs && exp.trace_refs.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {exp.trace_refs.length} trace reference{exp.trace_refs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Bullets List */}
                <div className="mt-3 space-y-2.5">
                  {(exp.bullets || []).map((bullet, bIdx) => {
                    const bulletKey = `${exp.id || expIdx}-${bIdx}`;
                    const isExpanded = !!expandedBullets[bulletKey];

                    // Find traces associated with this explanation
                    const referencedTraces = (exp.trace_refs || [])
                      .map((idx) => traceList[idx])
                      .filter(Boolean);

                    return (
                      <div
                        key={bulletKey}
                        className="rounded-lg bg-slate-900/80 border border-slate-800/80 overflow-hidden"
                      >
                        <div
                          onClick={() => toggleBullet(bulletKey)}
                          className="px-3 py-2.5 flex items-start gap-2.5 cursor-pointer hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="text-indigo-400 mt-0.5 text-xs">▸</span>
                          <p className="text-xs font-medium text-slate-200 leading-relaxed flex-1">
                            {bullet}
                          </p>

                          {referencedTraces.length > 0 && (
                            <button
                              type="button"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap flex items-center gap-1"
                            >
                              <span>{isExpanded ? 'Hide Trace' : 'View Trace'}</span>
                              <span className="text-[9px]">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          )}
                        </div>

                        {/* Expandable Trace Details */}
                        {isExpanded && referencedTraces.length > 0 && (
                          <div className="px-3.5 py-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                              <span>🔍</span> Underlying Sub-Agent Decision Traces:
                            </div>

                            {referencedTraces.map((trace, tIdx) => (
                              <div
                                key={tIdx}
                                className="p-2.5 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] space-y-1 font-mono"
                              >
                                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-indigo-300 uppercase">
                                      {trace.agent || 'Agent'}
                                    </span>
                                    <span className="text-slate-500">::</span>
                                    <span className="text-slate-300 font-semibold">
                                      {trace.step || 'execute'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {trace.used_llm && (
                                      <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[9px]">
                                        xAI Grok
                                      </span>
                                    )}
                                    {trace.fallback_used && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[9px]">
                                        Fallback
                                      </span>
                                    )}
                                    <span>⏱️ t={trace.at_min ?? 0}m</span>
                                  </div>
                                </div>

                                <p className="text-slate-300 font-sans text-xs pt-1">
                                  {trace.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

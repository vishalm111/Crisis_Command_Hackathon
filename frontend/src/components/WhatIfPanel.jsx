import React, { useState } from 'react';

export default function WhatIfPanel({ apiUrl = "", resources = [], incidents = [] }) {
  const [triggerKind, setTriggerKind] = useState('resource_failure');
  const [targetId, setTargetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const baseUrl = apiUrl || (typeof window !== 'undefined' && window.__VITE_API_URL__) || 'http://localhost:8000';

  const handleRun = async () => {
    if (!targetId) {
      setError('Please select a target ID.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    const payload = {};
    if (triggerKind === 'resource_failure') payload.resource_id = targetId;
    else if (triggerKind === 'new_incident') payload.incident = { id: targetId, severity: 5 };
    else if (triggerKind === 'escalation') {
      payload.incident_id = targetId;
      payload.severity = 5;
    }

    try {
      const res = await fetch(`${baseUrl}/api/whatif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: triggerKind, payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `WhatIf request failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col text-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
          <span>🔮</span> What-If Simulator
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Test crisis scenarios without affecting live state
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Form Controls */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Trigger Event</label>
            <select 
              value={triggerKind}
              onChange={(e) => setTriggerKind(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
            >
              <option value="resource_failure">Resource Failure</option>
              <option value="escalation">Incident Escalation</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Target</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
            >
              <option value="">-- Select Target --</option>
              {triggerKind === 'resource_failure' && resources.map(r => (
                <option key={r.id} value={r.id}>{r.id} ({r.type})</option>
              ))}
              {triggerKind === 'escalation' && incidents.map(i => (
                <option key={i.id} value={i.id}>{i.id} (Sev {i.severity})</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRun}
            disabled={isLoading || !targetId}
            className={`mt-2 py-2 rounded-lg font-bold text-sm transition-colors ${
              isLoading || !targetId 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {isLoading ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-indigo-300 mb-2">Simulation Results</h3>
            
            <div className="flex gap-2 text-xs">
              <span className={`px-2 py-1 rounded font-semibold ${result.approval_required ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                Approval: {result.approval_required ? 'Required' : 'Auto-Approved'}
              </span>
            </div>

            {result.conflicts && result.conflicts.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-xs">
                <span className="font-bold text-amber-400 block mb-1">⚠️ Conflicts Detected:</span>
                <ul className="list-disc pl-4 text-amber-200">
                  {result.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400 block mb-1">Affected Incidents</span>
                <span className="font-mono text-slate-200">{result.affected_incidents?.join(', ') || 'None'}</span>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400 block mb-1">Affected Resources</span>
                <span className="font-mono text-slate-200">{result.affected_resources?.join(', ') || 'None'}</span>
              </div>
            </div>

            {/* Metrics comparison */}
            {result.metrics_before && result.metrics_after && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Metrics Impact</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-800 p-1.5 rounded">
                    <span className="block text-slate-500 text-[10px] uppercase">Avg ETA</span>
                    <span className="text-slate-300 line-through mr-1">{result.metrics_before.avg_eta_min.toFixed(1)}</span>
                    <span className="text-indigo-300 font-bold">{result.metrics_after.avg_eta_min.toFixed(1)}</span>
                  </div>
                  <div className="bg-slate-800 p-1.5 rounded">
                    <span className="block text-slate-500 text-[10px] uppercase">Max ETA</span>
                    <span className="text-slate-300 line-through mr-1">{result.metrics_before.max_eta_min.toFixed(1)}</span>
                    <span className="text-indigo-300 font-bold">{result.metrics_after.max_eta_min.toFixed(1)}</span>
                  </div>
                  <div className="bg-slate-800 p-1.5 rounded">
                    <span className="block text-slate-500 text-[10px] uppercase">Coverage</span>
                    <span className="text-slate-300 line-through mr-1">{result.metrics_before.coverage_pct.toFixed(0)}%</span>
                    <span className="text-indigo-300 font-bold">{result.metrics_after.coverage_pct.toFixed(0)}%</span>
                  </div>
                  <div className="bg-slate-800 p-1.5 rounded">
                    <span className="block text-slate-500 text-[10px] uppercase">Unresolved</span>
                    <span className="text-slate-300 line-through mr-1">{result.metrics_before.unresolved_count}</span>
                    <span className="text-indigo-300 font-bold">{result.metrics_after.unresolved_count}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

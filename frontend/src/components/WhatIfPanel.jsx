import React, { useState } from 'react';
import { postJson } from '../api';

/**
 * WhatIfPanel allows human coordinators to safely simulate hypothetical
 * disruptions (resource failure, new incident, severity escalation)
 * exclusively on an isolated backend snapshot without mutating live state.
 */
export default function WhatIfPanel({
  state = null,
  apiUrl = '',
}) {
  const [scenarioType, setScenarioType] = useState('resource_failure');
  const [resourceId, setResourceId] = useState('F2');
  const [incidentId, setIncidentId] = useState('I1');
  const [escalateSeverity, setEscalateSeverity] = useState(5);
  const [newIncidentType, setNewIncidentType] = useState('medical');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState(4);
  const [newIncidentDesc, setNewIncidentDesc] = useState('Traffic pileup near Richmond Circle with multiple casualties');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const resourceList = state?.resources || [
    { id: 'A1' }, { id: 'A2' }, { id: 'A3' },
    { id: 'F1' }, { id: 'F2' }, { id: 'R1' },
  ];

  const incidentList = state?.incidents || [
    { id: 'I1' }, { id: 'I2' }, { id: 'I4' },
  ];

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);

    let payload = {};
    let kind = scenarioType;

    if (scenarioType === 'resource_failure') {
      payload = { resource_id: resourceId };
    } else if (scenarioType === 'escalation') {
      payload = { incident_id: incidentId, severity: Number(escalateSeverity) };
    } else if (scenarioType === 'new_incident') {
      payload = {
        incident: {
          id: `I_SIM_${Date.now().toString().slice(-4)}`,
          type: newIncidentType,
          severity: Number(newIncidentSeverity),
          description: newIncidentDesc,
          people_affected: 4,
          required: newIncidentType === 'fire' ? { fire_engine: 1 } : { ambulance: 1 },
          location: { lat: 12.9610, lng: 77.5970, label: 'Richmond Circle' },
        },
      };
    }

    try {
      const res = await postJson('/whatif', {
        kind: kind,
        payload: payload,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || 'What-If simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>🔮</span> What-If Sandbox
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Isolated snapshot simulation &bull; Zero live state mutation
          </p>
        </div>

        {result && (
          <button
            onClick={() => setResult(null)}
            className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Clear Result
          </button>
        )}
      </div>

      {/* Configuration Form */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 flex flex-col gap-2.5 text-xs">
        <div>
          <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
            Hypothetical Disruption
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScenarioType('resource_failure')}
              className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                scenarioType === 'resource_failure'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
              }`}
            >
              Fail Unit
            </button>
            <button
              type="button"
              onClick={() => setScenarioType('escalation')}
              className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                scenarioType === 'escalation'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
              }`}
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => setScenarioType('new_incident')}
              className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                scenarioType === 'new_incident'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
              }`}
            >
              New Incident
            </button>
          </div>
        </div>

        {/* Dynamic Controls based on Scenario Type */}
        {scenarioType === 'resource_failure' && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Target Resource:</label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {resourceList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} {r.name ? `(${r.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {scenarioType === 'escalation' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Incident:</label>
              <select
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {incidentList.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">New Severity (1-5):</label>
              <select
                value={escalateSeverity}
                onChange={(e) => setEscalateSeverity(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={5}>5 - Catastrophic</option>
                <option value={4}>4 - Severe</option>
                <option value={3}>3 - Moderate</option>
                <option value={2}>2 - Minor</option>
              </select>
            </div>
          </div>
        )}

        {scenarioType === 'new_incident' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Type:</label>
                <select
                  value={newIncidentType}
                  onChange={(e) => setNewIncidentType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="medical">Medical</option>
                  <option value="fire">Fire</option>
                  <option value="rescue">Rescue</option>
                  <option value="hazmat">Hazmat</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Severity:</label>
                <select
                  value={newIncidentSeverity}
                  onChange={(e) => setNewIncidentSeverity(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value={5}>5 - Critical</option>
                  <option value={4}>4 - High</option>
                  <option value={3}>3 - Medium</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Description:</label>
              <input
                type="text"
                value={newIncidentDesc}
                onChange={(e) => setNewIncidentDesc(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSimulate}
          disabled={loading}
          className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md mt-1 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin text-sm">⏳</span>
              <span>Running Simulation...</span>
            </>
          ) : (
            <span>Run What-If Simulation</span>
          )}
        </button>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 font-medium text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Simulation Result Output */}
      <div className="flex-1 overflow-y-auto max-h-[240px] p-3 text-xs">
        {!result ? (
          <div className="p-4 text-center text-slate-400 flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base mb-1.5 text-slate-400">
              🔮
            </div>
            <h3 className="text-xs font-semibold text-slate-200">No Simulation Active</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
              Configure parameters above and run a hypothetical scenario to inspect impact, preemption, and human approval necessity.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {/* Approval Requirement Flag */}
            <div
              className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                result.approval_required
                  ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>{result.approval_required ? '🛡️' : '✅'}</span>
                <span>
                  {result.approval_required
                    ? 'Human Approval Gate: REQUIRED'
                    : 'Human Approval Gate: NOT REQUIRED'}
                </span>
              </div>
              {result.reasons?.length > 0 && (
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-300 pl-1">
                  {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Impacted Entities */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  Affected Incidents
                </span>
                <div className="flex flex-wrap gap-1">
                  {result.affected_incidents?.length > 0 ? (
                    result.affected_incidents.map((id) => (
                      <span key={id} className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">None</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  Affected Resources
                </span>
                <div className="flex flex-wrap gap-1">
                  {result.affected_resources?.length > 0 ? (
                    result.affected_resources.map((id) => (
                      <span key={id} className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Conflicts */}
            {result.conflicts?.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block mb-1">
                  Identified Conflicts
                </span>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-300">
                  {result.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metrics Comparison Strip */}
            {(result.metrics_before || result.metrics_after) && (
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Performance Projection
                </span>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Avg ETA</span>
                    <span className="text-slate-200 font-semibold">
                      {result.metrics_before?.avg_eta_min?.toFixed(1) ?? '--'}m &rarr; {result.metrics_after?.avg_eta_min?.toFixed(1) ?? '--'}m
                    </span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Max ETA</span>
                    <span className="text-slate-200 font-semibold">
                      {result.metrics_before?.max_eta_min?.toFixed(1) ?? '--'}m &rarr; {result.metrics_after?.max_eta_min?.toFixed(1) ?? '--'}m
                    </span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Coverage</span>
                    <span className="text-emerald-400 font-semibold">
                      {result.metrics_before?.coverage_pct?.toFixed(0) ?? '--'}% &rarr; {result.metrics_after?.coverage_pct?.toFixed(0) ?? '--'}%
                    </span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Unresolved</span>
                    <span className="text-rose-400 font-semibold">
                      {result.metrics_before?.unresolved_count ?? 0} &rarr; {result.metrics_after?.unresolved_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Proposed Plan Assignments Count */}
            {result.proposed_plan && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
                <span>Proposed Plan: {result.proposed_plan.assignments?.length || 0} units assigned</span>
                <span>Unmet: {result.proposed_plan.unmet?.length || 0} incident slots</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

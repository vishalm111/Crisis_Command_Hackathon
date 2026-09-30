import React, { useState } from 'react';
import WhyResourceModal from './WhyResourceModal';

/**
 * PlanPanel renders the current or proposed dispatch plan,
 * including key metrics, active assignments, and unmet resource slots.
 *
 * @param {Object} props
 * @param {Object} [props.plan] - Plan object conforming to contract domain model
 * @param {Array} [props.incidents] - Optional list of incidents for metadata lookup
 * @param {Array} [props.resources] - Optional list of resources for name lookup
 * @param {Object} [props.state] - Full system state
 * @param {string} [props.title="Active Dispatch Plan"] - Title for the panel
 */
export default function PlanPanel({
  plan = null,
  incidents = [],
  resources = [],
  state = null,
  title = "Active Dispatch Plan",
}) {
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const currentPlan = plan || {
    id: "none",
    version: 0,
    assignments: [],
    unmet: [],
    metrics: {
      avg_eta_min: 0,
      max_eta_min: 0,
      coverage_pct: 0,
      utilization_pct: 0,
      unresolved_count: 0,
    },
  };

  const { assignments = [], unmet = [], metrics = {}, version = 0, id = "" } = currentPlan;

  // Build lookup helpers
  const resourceMap = new Map((resources || []).map((r) => [r.id, r]));
  const incidentMap = new Map((incidents || []).map((inc) => [inc.id, inc]));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>📋</span> {title}
          </h2>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            ID: <span className="text-slate-300">{id || "unassigned"}</span> | Version: <span className="text-indigo-400 font-bold">v{version}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {assignments.length} assigned
          </span>
          {unmet.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {unmet.length} unmet
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 px-3 py-2 bg-slate-900/50 border-b border-slate-800/80 text-center">
        <div className="bg-slate-800/40 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Avg ETA</div>
          <div className="text-base font-bold text-sky-400 mt-0.5">
            {metrics.avg_eta_min != null ? `${Number(metrics.avg_eta_min).toFixed(1)}m` : "--"}
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Max ETA</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">
            {metrics.max_eta_min != null ? `${Number(metrics.max_eta_min).toFixed(1)}m` : "--"}
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Coverage</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {metrics.coverage_pct != null ? `${Number(metrics.coverage_pct).toFixed(0)}%` : "--"}
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Utilization</div>
          <div className="text-base font-bold text-purple-400 mt-0.5">
            {metrics.utilization_pct != null ? `${Number(metrics.utilization_pct).toFixed(0)}%` : "--"}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-slate-800/40 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Unresolved</div>
          <div className="text-base font-bold text-rose-400 mt-0.5">
            {metrics.unresolved_count != null ? metrics.unresolved_count : 0}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[280px]">
        {/* Unmet Slots Alert Section */}
        {unmet.length > 0 && (
          <div className="rounded-lg bg-rose-950/20 border border-rose-900/50 p-2.5">
            <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span>⚠️</span> Unmet Incident Slots ({unmet.length})
            </h3>
            <div className="space-y-2">
              {unmet.map((item, idx) => {
                const inc = incidentMap.get(item.incident_id);
                return (
                  <div
                    key={`unmet-${item.incident_id}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-rose-950/40 border border-rose-900/30 rounded p-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-rose-300 mr-2">
                        {item.incident_id}
                      </span>
                      {inc?.description && (
                        <span className="text-slate-300">{inc.description}</span>
                      )}
                    </div>
                    <div className="mt-1 sm:mt-0 font-medium text-rose-200 flex items-center gap-1.5">
                      <span className="text-rose-400">Missing:</span>
                      {Object.entries(item.missing || {}).map(([resType, count]) => (
                        <span
                          key={resType}
                          className="px-1.5 py-0.5 bg-rose-900/40 rounded text-[11px] font-mono"
                        >
                          {count}x {resType}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assignments List */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Current Assignments</span>
            <span className="text-[11px] font-normal text-slate-500 font-mono">
              Count: {assignments.length}
            </span>
          </h3>

          {assignments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm italic border border-dashed border-slate-800 rounded-lg">
              No active resource assignments in this plan.
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((asg) => {
                const res = resourceMap.get(asg.resource_id);
                const inc = incidentMap.get(asg.incident_id);

                return (
                  <div
                    key={asg.id || `${asg.resource_id}-${asg.incident_id}`}
                    className="p-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700/80 rounded-lg transition-colors flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sky-400 text-sm">
                          {asg.resource_id}
                        </span>
                        {res?.name && (
                          <span className="text-xs text-slate-300">({res.name})</span>
                        )}
                        <span className="text-slate-500 text-xs">➔</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {asg.incident_id}
                        </span>
                        {inc?.type && (
                          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                            {inc.type}
                          </span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {asg.locked && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            🔒 LOCKED
                          </span>
                        )}
                        {asg.approved && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ✓ APPROVED
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/60">
                          {asg.eta_min != null ? `${Number(asg.eta_min).toFixed(1)}m` : "--"}
                        </span>
                      </div>
                    </div>

                    {/* Routing and Rationale Details */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-y-1">
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        {asg.distance_km != null && (
                          <span>Distance: <strong className="text-slate-300">{Number(asg.distance_km).toFixed(1)} km</strong></span>
                        )}
                        {asg.facility_id && (
                          <span>Facility: <strong className="text-slate-300 font-mono">{asg.facility_id}</strong></span>
                        )}
                      </div>
                      {asg.reason && (
                        <div className="text-[11px] text-slate-400 italic">
                          &quot;{asg.reason}&quot;
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedAssignment(asg)}
                        className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 px-2 py-0.5 rounded transition-colors flex items-center gap-1 ml-auto"
                      >
                        <span>💡</span> Why this resource?
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Feature 8: Explainability Modal */}
      {selectedAssignment && (
        <WhyResourceModal
          assignment={selectedAssignment}
          state={state}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </div>
  );
}

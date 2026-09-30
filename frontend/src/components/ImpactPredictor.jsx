import React, { useMemo } from 'react';

/**
 * ImpactPredictor: 10-Minute Risk & Capacity Bottleneck Forecaster
 * Analyzes active resource trajectories, arriving units, and unmet incident demands
 * to forecast bottlenecks and risk escalation before they occur.
 */
export default function ImpactPredictor({ state }) {
  const incidents = state?.incidents || [];
  const resources = state?.resources || [];
  const currentPlan = state?.current_plan || {};
  const assignments = currentPlan.assignments || [];

  // Calculate forward projections
  const analysis = useMemo(() => {
    // Total demands by resource type
    const requiredByType = {};
    incidents.forEach((inc) => {
      if (inc.status !== 'resolved' && inc.required) {
        Object.entries(inc.required).forEach(([type, count]) => {
          requiredByType[type] = (requiredByType[type] || 0) + count;
        });
      }
    });

    // Available and assigned fleet
    const availableByType = {};
    const assignedByType = {};
    const unavailableByType = {};

    resources.forEach((r) => {
      if (r.status === 'available') {
        availableByType[r.type] = (availableByType[r.type] || 0) + 1;
      } else if (r.status === 'unavailable') {
        unavailableByType[r.type] = (unavailableByType[r.type] || 0) + 1;
      } else {
        assignedByType[r.type] = (assignedByType[r.type] || 0) + 1;
      }
    });

    // Bottlenecks: resource types where required > (available + assigned)
    const allTypes = Array.from(
      new Set([
        ...Object.keys(requiredByType),
        ...Object.keys(availableByType),
        ...Object.keys(assignedByType),
      ])
    );

    const deficitByType = {};
    let totalDeficit = 0;

    allTypes.forEach((t) => {
      const req = requiredByType[t] || 0;
      const supply = (availableByType[t] || 0) + (assignedByType[t] || 0);
      if (req > supply) {
        const diff = req - supply;
        deficitByType[t] = diff;
        totalDeficit += diff;
      }
    });

    // High risk incidents (severity >= 3 with no assigned units or ETA > 6m)
    const atRiskIncidents = incidents
      .filter((inc) => inc.status !== 'resolved')
      .map((inc) => {
        const incAssignments = assignments.filter((a) => a.incident_id === inc.id);
        const maxEta = incAssignments.length > 0 ? Math.max(...incAssignments.map((a) => a.eta_min || 0)) : 999;
        const isCovered = incAssignments.length > 0;
        const riskScore =
          inc.severity * 20 +
          (isCovered ? 0 : 35) +
          (maxEta > 6 && maxEta < 999 ? 20 : 0);
        return {
          ...inc,
          assignedCount: incAssignments.length,
          maxEta,
          riskScore: Math.min(100, riskScore),
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // Projected arrival completions within 10 min
    const arrivingSoon = assignments.filter((a) => (a.eta_min || 0) <= 10);

    return {
      deficitByType,
      totalDeficit,
      atRiskIncidents,
      arrivingSoonCount: arrivingSoon.length,
      overallRisk:
        totalDeficit > 2 || atRiskIncidents.some((i) => i.riskScore > 75)
          ? 'HIGH'
          : totalDeficit > 0
          ? 'MODERATE'
          : 'LOW',
    };
  }, [incidents, resources, assignments]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔮</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              Future Impact Predictor &bull; 10m Projection
            </h2>
            <p className="text-[11px] text-slate-400">
              Forward-looking bottleneck risk, arrival delays, and capacity shortages
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wider ${
            analysis.overallRisk === 'HIGH'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              : analysis.overallRisk === 'MODERATE'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          {analysis.overallRisk} RISK TRAJECTORY
        </span>
      </div>

      {/* Projection Content */}
      <div className="p-3 space-y-3 text-xs">
        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Capacity Deficit (+10m)
            </span>
            <span
              className={`text-base font-bold font-mono ${
                analysis.totalDeficit > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {analysis.totalDeficit > 0 ? `-${analysis.totalDeficit} Units` : 'Balanced'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Units Arriving &le;10m
            </span>
            <span className="text-base font-bold text-sky-400 font-mono">
              {analysis.arrivingSoonCount} Units
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Vulnerable Incidents
            </span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {analysis.atRiskIncidents.filter((i) => i.riskScore > 50).length} Sites
            </span>
          </div>
        </div>

        {/* Capacity Breakdown */}
        {Object.keys(analysis.deficitByType).length > 0 ? (
          <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-2.5">
            <span className="text-[11px] font-bold text-rose-300 block mb-1">
              ⚠️ Critical Shortage Anticipated:
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analysis.deficitByType).map(([type, cnt]) => (
                <span
                  key={type}
                  className="bg-rose-900/40 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded font-mono text-[11px]"
                >
                  {type}: -{cnt} required
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2 text-emerald-300 text-[11px] flex items-center gap-1.5">
            <span>✓</span>
            <span>Current vehicle supply meets all estimated 10-minute containment demands.</span>
          </div>
        )}

        {/* Priority Threat Matrix */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            At-Risk Incident Trajectory (Top 3):
          </span>
          <div className="space-y-1.5">
            {analysis.atRiskIncidents.slice(0, 3).map((inc) => (
              <div
                key={inc.id}
                className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-mono">{inc.id}</span>
                  <span className="text-slate-400 capitalize">({inc.type})</span>
                  <span className="text-rose-400 font-semibold">Sev {inc.severity}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {inc.assignedCount > 0 ? `${inc.assignedCount} units assigned` : '⚠️ 0 units assigned'}
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      inc.riskScore > 75
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    Risk: {inc.riskScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

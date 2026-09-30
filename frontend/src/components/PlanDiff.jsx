import React from 'react';

export default function PlanDiff({ diff, metricsBefore, metricsAfter }) {
  if (!diff || !diff.changes || diff.changes.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col p-6 text-center text-slate-500">
        <h3 className="text-sm font-semibold text-slate-300">No Changes</h3>
        <p className="text-xs mt-1">The proposed plan is identical to the current plan.</p>
      </div>
    );
  }

  const renderMetric = (label, before, after, suffix = '', inverseGood = false) => {
    if (before == null || after == null) return null;
    const diffVal = after - before;
    let colorClass = 'text-slate-300';
    let icon = '';
    
    if (diffVal !== 0) {
      const isGood = inverseGood ? diffVal < 0 : diffVal > 0;
      colorClass = isGood ? 'text-emerald-400' : 'text-rose-400';
      icon = isGood ? (inverseGood ? '↓' : '↑') : (inverseGood ? '↑' : '↓');
    }

    return (
      <div className="flex flex-col bg-slate-950 p-2 rounded-lg border border-slate-800">
        <span className="text-[10px] text-slate-400 uppercase font-bold">{label}</span>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-sm text-slate-500 line-through">{before.toFixed(1)}{suffix}</span>
          <span className={`text-base font-bold ${colorClass}`}>
            {after.toFixed(1)}{suffix} {icon && <span className="text-xs">{icon}</span>}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-xl shadow-xl flex flex-col overflow-hidden text-slate-100">
      <div className="px-5 py-4 border-b border-slate-800 bg-indigo-950/20">
        <h2 className="text-lg font-semibold tracking-tight text-indigo-300 flex items-center gap-2">
          <span>🔄</span> Plan Modifications
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Version {diff.from_version} → {diff.to_version}
        </p>
      </div>
      
      {metricsBefore && metricsAfter && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-900/50 border-b border-slate-800">
          {renderMetric('Avg ETA', metricsBefore.avg_eta_min, metricsAfter.avg_eta_min, 'm', true)}
          {renderMetric('Max ETA', metricsBefore.max_eta_min, metricsAfter.max_eta_min, 'm', true)}
          {renderMetric('Coverage', metricsBefore.coverage_pct, metricsAfter.coverage_pct, '%', false)}
          {renderMetric('Unresolved', metricsBefore.unresolved_count, metricsAfter.unresolved_count, '', true)}
        </div>
      )}

      <div className="p-0 overflow-y-auto max-h-64">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-2">Resource</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {diff.changes.map((change, idx) => {
              let actionNode;
              if (change.kind === 'added') {
                actionNode = <span className="text-emerald-400 font-medium">Added to {change.new_incident_id}</span>;
              } else if (change.kind === 'removed') {
                actionNode = <span className="text-rose-400 font-medium">Removed from {change.old_incident_id}</span>;
              } else if (change.kind === 'reassigned') {
                actionNode = (
                  <span>
                    <span className="text-slate-400 line-through mr-1">{change.old_incident_id}</span>
                    <span className="text-amber-400 font-medium">→ {change.new_incident_id}</span>
                  </span>
                );
              } else {
                actionNode = <span className="text-blue-400 font-medium">ETA {change.old_eta_min?.toFixed(1)}m → {change.new_eta_min?.toFixed(1)}m</span>;
              }

              return (
                <tr key={`${change.resource_id}-${idx}`} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono font-bold text-slate-200">{change.resource_id}</td>
                  <td className="px-4 py-3 text-sm">{actionNode}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 italic">{change.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

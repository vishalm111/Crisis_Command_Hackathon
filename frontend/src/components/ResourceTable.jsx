import React from 'react';

// Optional fallback to mock_state.json when standalone
let mockState = {};
try {
  mockState = require('../../../contracts/mock_state.json');
} catch (e) {
  // If require/import not available at runtime, handled gracefully
}

const STATUS_COLORS = {
  available: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  unavailable: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  assigned: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export default function ResourceTable({ resources = null, currentPlan = null, onFail = null, onRestore = null }) {
  const resourceList = resources !== null ? resources : (mockState.resources || []);
  const plan = currentPlan !== null ? currentPlan : (mockState.current_plan || null);

  const assignmentsByRes = {};
  if (plan && plan.assignments) {
    plan.assignments.forEach(asg => {
      assignmentsByRes[asg.resource_id] = asg;
    });
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden text-slate-100">
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
          <span>🚒</span> Resource Roster
        </h2>
      </div>
      <div className="p-0 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {resourceList.map(res => {
              const asg = assignmentsByRes[res.id];
              const statusClass = STATUS_COLORS[res.status] || 'bg-slate-800 text-slate-300 border-slate-700';
              
              return (
                <tr key={res.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-200">{res.id}</td>
                  <td className="px-4 py-3 capitalize">{res.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusClass}`}>
                      {res.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {asg ? (
                      <div>
                        <span className="text-indigo-300 font-semibold">{asg.incident_id}</span>
                        {asg.eta_min != null && <span className="text-slate-400 ml-2">ETA: {asg.eta_min.toFixed(1)}m</span>}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {res.status === 'unavailable' ? (
                      <button 
                        onClick={() => onRestore && onRestore(res.id)}
                        className="px-2 py-1 bg-emerald-600/20 text-emerald-400 text-xs rounded hover:bg-emerald-600/40"
                      >
                        Restore
                      </button>
                    ) : (
                      <button 
                        onClick={() => onFail && onFail(res.id)}
                        className="px-2 py-1 bg-rose-600/20 text-rose-400 text-xs rounded hover:bg-rose-600/40"
                      >
                        Fail
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

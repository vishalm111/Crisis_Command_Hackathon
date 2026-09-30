import React, { useState } from 'react';

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-500',
  },
  en_route: {
    label: 'En Route',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dot: 'bg-blue-500',
  },
  on_scene: {
    label: 'On Scene',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    dot: 'bg-purple-500',
  },
  unavailable: {
    label: 'Unavailable',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    dot: 'bg-rose-500',
  },
};

const TYPE_CONFIG = {
  ambulance: { icon: '🚑', label: 'Ambulance' },
  fire_engine: { icon: '🚒', label: 'Fire Engine' },
  rescue_unit: { icon: '👷', label: 'Rescue Unit' },
  hazmat_team: { icon: '☣️', label: 'Hazmat Team' },
};

/**
 * ResourceTable displays live emergency fleet status, current assignments,
 * ETAs, locations, and lock/approval constraints.
 */
export default function ResourceTable({
  resources = null,
  assignments = null,
  constraints = null,
  state = null,
}) {
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Derive data from state prop or individual props
  const resourceList = resources || state?.resources || [];
  const activeAssignments = assignments || state?.current_plan?.assignments || [];
  const activeConstraints = constraints || state?.constraints || [];

  // Build lookups for quick metadata joining
  const assignmentMap = new Map(activeAssignments.map((a) => [a.resource_id, a]));
  const constraintMap = new Map(activeConstraints.map((c) => [c.resource_id, c]));

  // Filter items
  const filteredResources = resourceList.filter((res) => {
    if (filterType !== 'ALL' && (res.type || '').toLowerCase() !== filterType.toLowerCase()) {
      return false;
    }
    if (filterStatus !== 'ALL' && (res.status || '').toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    return true;
  });

  const availableCount = resourceList.filter((r) => r.status === 'available').length;
  const enRouteCount = resourceList.filter((r) => r.status === 'en_route').length;
  const unavailableCount = resourceList.filter((r) => r.status === 'unavailable').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>🚒</span> Fleet & Resources
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {resourceList.length} units total | {availableCount} ready | {enRouteCount} dispatched | {unavailableCount} offline
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="ambulance">Ambulances</option>
            <option value="fire_engine">Fire Engines</option>
            <option value="rescue_unit">Rescue Units</option>
            <option value="hazmat_team">Hazmat Teams</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="available">Available</option>
            <option value="en_route">En Route</option>
            <option value="on_scene">On Scene</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[240px]">
        {filteredResources.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No resources match the selected criteria.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-1.5 px-2.5">Unit</th>
                <th className="py-1.5 px-2.5">Type</th>
                <th className="py-1.5 px-2.5">Status</th>
                <th className="py-1.5 px-2.5">Assignment</th>
                <th className="py-1.5 px-2.5">ETA</th>
                <th className="py-1.5 px-2.5">Location / Base</th>
                <th className="py-1.5 px-2.5">Lock State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredResources.map((res) => {
                const asg = assignmentMap.get(res.id);
                const constraint = constraintMap.get(res.id);
                const typeInfo = TYPE_CONFIG[res.type] || { icon: '📦', label: res.type };
                const statusInfo = STATUS_CONFIG[res.status] || {
                  label: res.status,
                  badge: 'bg-slate-700 text-slate-300 border-slate-600',
                  dot: 'bg-slate-400',
                };

                const isLocked = asg?.locked || constraint?.kind === 'locked';
                const isApproved = asg?.approved || constraint?.kind === 'approved';

                return (
                  <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Unit ID */}
                    <td className="py-1.5 px-2.5 font-bold text-white flex items-center gap-1.5">
                      <span>{typeInfo.icon}</span>
                      <span>{res.id}</span>
                    </td>

                    {/* Type */}
                    <td className="py-1.5 px-2.5 text-slate-300 font-sans">
                      {typeInfo.label}
                    </td>

                    {/* Status Badge */}
                    <td className="py-1.5 px-2.5 font-sans">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Current Assignment */}
                    <td className="py-1.5 px-2.5">
                      {asg ? (
                        <span className="text-indigo-400 font-semibold">
                          {asg.incident_id}
                        </span>
                      ) : res.assigned_incident_id ? (
                        <span className="text-indigo-400 font-semibold">
                          {res.assigned_incident_id}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-sans italic">None</span>
                      )}
                    </td>

                    {/* ETA */}
                    <td className="py-1.5 px-2.5 text-slate-300">
                      {asg ? (
                        <span>{asg.eta_min.toFixed(1)}m</span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Location / Base */}
                    <td className="py-1.5 px-2.5 text-slate-400 truncate max-w-[140px] font-sans" title={res.location?.label || res.base?.label}>
                      {res.location?.label || res.base?.label || `${res.location?.lat.toFixed(3)}, ${res.location?.lng.toFixed(3)}`}
                    </td>

                    {/* Lock State */}
                    <td className="py-1.5 px-2.5 font-sans">
                      {isLocked ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          🔒 Locked
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          🛡️ Approved
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[11px]">Free</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

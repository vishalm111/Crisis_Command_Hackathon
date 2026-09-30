import React, { useState } from 'react';

/**
 * DependencyGraph: Interactive SVG Resource -> Assignment -> Incident Dependency Graph
 * Visualizes operational bindings, active transit conduits, and severed assignments.
 */
export default function DependencyGraph({ state }) {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const resources = state?.resources || [];
  const incidents = state?.incidents || [];
  const assignments = state?.current_plan?.assignments || [];

  // Dimensions
  const width = 640;
  const height = 320;
  const leftX = 80;
  const rightX = 560;

  // Node layout
  const resSpacing = Math.max(35, (height - 40) / (resources.length || 1));
  const resNodes = resources.map((r, i) => ({
    id: r.id,
    type: 'resource',
    data: r,
    x: leftX,
    y: 35 + i * resSpacing,
  }));

  const incSpacing = Math.max(45, (height - 40) / (incidents.length || 1));
  const incNodes = incidents.map((inc, i) => ({
    id: inc.id,
    type: 'incident',
    data: inc,
    x: rightX,
    y: 40 + i * incSpacing,
  }));

  // Build links
  const links = assignments.map((asg) => {
    const sourceNode = resNodes.find((n) => n.id === asg.resource_id);
    const targetNode = incNodes.find((n) => n.id === asg.incident_id);
    return {
      asg,
      source: sourceNode,
      target: targetNode,
    };
  }).filter((l) => l.source && l.target);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🕸️</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              Resource Dependency Graph &bull; Operational Topology
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive node-link dispatch conduits between fleet assets and incident sites
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span> Available/On-Scene
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span> En-Route
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span> Failed/Offline
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative p-2 bg-slate-950/80 flex items-center justify-center overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[640px] h-[260px] select-none">
          <defs>
            <linearGradient id="linkGradEnRoute" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="linkGradFailed" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Links */}
          {links.map((link, idx) => {
            const sx = link.source.x;
            const sy = link.source.y;
            const tx = link.target.x;
            const ty = link.target.y;
            const isFailed = link.source.data?.status === 'unavailable';
            const isSelected =
              selectedEntity?.id === link.asg.resource_id ||
              selectedEntity?.id === link.asg.incident_id;

            const path = `M ${sx} ${sy} C ${sx + 150} ${sy}, ${tx - 150} ${ty}, ${tx} ${ty}`;

            return (
              <g key={idx} className="cursor-pointer" onClick={() => setSelectedEntity({ type: 'assignment', data: link.asg })}>
                <path
                  d={path}
                  fill="none"
                  stroke={isFailed ? 'url(#linkGradFailed)' : isSelected ? '#a855f7' : 'url(#linkGradEnRoute)'}
                  strokeWidth={isSelected ? 3.5 : 2}
                  strokeDasharray={isFailed ? '4,4' : 'none'}
                  className="transition-all hover:stroke-purple-400"
                />
                {/* Link label badge */}
                <rect
                  x={(sx + tx) / 2 - 24}
                  y={(sy + ty) / 2 - 9}
                  width={48}
                  height={18}
                  rx={4}
                  fill="#0f172a"
                  stroke={isFailed ? '#f43f5e' : '#475569'}
                  strokeWidth={1}
                />
                <text
                  x={(sx + tx) / 2}
                  y={(sy + ty) / 2 + 4}
                  textAnchor="middle"
                  fill={isFailed ? '#f43f5e' : '#38bdf8'}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {link.asg.eta_min ? `${link.asg.eta_min.toFixed(0)}m` : '0m'}
                </text>
              </g>
            );
          })}

          {/* Resource Nodes (Left) */}
          {resNodes.map((n) => {
            const isSelected = selectedEntity?.id === n.id;
            const isFailed = n.data.status === 'unavailable';
            const isEnRoute = n.data.status === 'en_route';
            const fillColor = isFailed ? '#881337' : isEnRoute ? '#0369a1' : '#064e3b';
            const strokeColor = isFailed ? '#f43f5e' : isEnRoute ? '#38bdf8' : '#34d399';

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedEntity({ type: 'resource', data: n.data })}
                className="cursor-pointer group"
              >
                <circle
                  r={isSelected ? 16 : 14}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all"
                />
                <text
                  textAnchor="middle"
                  dy={4}
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {n.id}
                </text>
                <text
                  x={-22}
                  y={4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize={10}
                  className="hidden sm:inline font-mono"
                >
                  {n.data.type?.replace('_', ' ')}
                </text>
              </g>
            );
          })}

          {/* Incident Nodes (Right) */}
          {incNodes.map((n) => {
            const isSelected = selectedEntity?.id === n.id;
            const isCritical = n.data.severity >= 4;
            const fillColor = isCritical ? '#7f1d1d' : '#854d0e';
            const strokeColor = isCritical ? '#f87171' : '#facc15';

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedEntity({ type: 'incident', data: n.data })}
                className="cursor-pointer group"
              >
                <rect
                  x={-14}
                  y={-14}
                  width={28}
                  height={28}
                  rx={6}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all"
                />
                <text
                  textAnchor="middle"
                  dy={4}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {n.id}
                </text>
                <text
                  x={22}
                  y={4}
                  textAnchor="start"
                  fill="#cbd5e1"
                  fontSize={10}
                  className="hidden sm:inline font-mono"
                >
                  Sev {n.data.severity} {n.data.type}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Entity Inspector Banner */}
      <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 text-xs flex items-center justify-between min-h-[38px]">
        {selectedEntity ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-indigo-400 capitalize">
              Selected {selectedEntity.type}:
            </span>
            <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {selectedEntity.data.id || `${selectedEntity.data.resource_id} ➔ ${selectedEntity.data.incident_id}`}
            </span>
            {selectedEntity.type === 'resource' && (
              <span className="text-slate-300">
                Status: <strong>{selectedEntity.data.status}</strong> | Type: {selectedEntity.data.type}
              </span>
            )}
            {selectedEntity.type === 'incident' && (
              <span className="text-slate-300">
                Severity: <strong>{selectedEntity.data.severity}/5</strong> | Status: {selectedEntity.data.status} | Location: {selectedEntity.data.location?.label}
              </span>
            )}
            {selectedEntity.type === 'assignment' && (
              <span className="text-slate-300">
                ETA: <strong>{selectedEntity.data.eta_min?.toFixed(1)}m</strong> | Role: {selectedEntity.data.role || 'Primary Responder'}
              </span>
            )}
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-slate-500 hover:text-slate-300 text-[10px] ml-auto underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="text-slate-500 italic text-[11px]">
            💡 Click on any fleet unit, link, or incident site node above to inspect live dependency binding.
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';

/**
 * DependencyGraph: Interactive SVG Resource -> Assignment -> Incident Dependency Graph
 * Visualizes operational bindings, active transit conduits, and severed assignments.
 * Supports Fullscreen mode for comprehensive tactical topology inspection.
 */
export default function DependencyGraph({ state }) {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const resources = state?.resources || [];
  const incidents = state?.incidents || [];
  const assignments = state?.current_plan?.assignments || [];

  // Dimensions adapt dynamically between compact and fullscreen modes
  const width = isFullscreen ? 1100 : 640;
  const height = isFullscreen ? 580 : 320;
  const leftX = isFullscreen ? 160 : 80;
  const rightX = isFullscreen ? 940 : 560;

  // Node layout
  const resSpacing = Math.max(isFullscreen ? 65 : 35, (height - 60) / (resources.length || 1));
  const resNodes = resources.map((r, i) => ({
    id: r.id,
    type: 'resource',
    data: r,
    x: leftX,
    y: (isFullscreen ? 50 : 35) + i * resSpacing,
  }));

  const incSpacing = Math.max(isFullscreen ? 85 : 45, (height - 60) / (incidents.length || 1));
  const incNodes = incidents.map((inc, i) => ({
    id: inc.id,
    type: 'incident',
    data: inc,
    x: rightX,
    y: (isFullscreen ? 60 : 40) + i * incSpacing,
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
    <div
      className={`transition-all duration-200 flex flex-col ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] bg-slate-950 p-4 h-screen w-screen shadow-2xl'
          : 'bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🕸️</span>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 truncate">
              Resource Dependency Graph &bull; Topology
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              Interactive dispatch conduits between fleet assets and incidents
            </p>
          </div>
          {isFullscreen && (
            <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0">
              FULL SCREEN
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium text-slate-400">
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

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand to Fullscreen'}
          >
            <span>{isFullscreen ? '✕' : '⛶'}</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className={`relative p-2 bg-slate-950/80 flex items-center justify-center overflow-x-auto ${isFullscreen ? 'flex-1' : ''}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full select-none ${isFullscreen ? 'h-full max-h-[calc(100vh-140px)]' : 'max-w-[640px] h-[260px]'}`}
        >
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

            const curveOffset = isFullscreen ? 260 : 150;
            const path = `M ${sx} ${sy} C ${sx + curveOffset} ${sy}, ${tx - curveOffset} ${ty}, ${tx} ${ty}`;

            return (
              <g key={idx} className="cursor-pointer" onClick={() => setSelectedEntity({ type: 'assignment', data: link.asg })}>
                <path
                  d={path}
                  fill="none"
                  stroke={isFailed ? 'url(#linkGradFailed)' : isSelected ? '#a855f7' : 'url(#linkGradEnRoute)'}
                  strokeWidth={isSelected ? 4 : isFullscreen ? 3 : 2}
                  strokeDasharray={isFailed ? '5,5' : 'none'}
                  className="transition-all hover:stroke-purple-400"
                />
                {/* Link label badge */}
                <rect
                  x={(sx + tx) / 2 - (isFullscreen ? 30 : 24)}
                  y={(sy + ty) / 2 - (isFullscreen ? 12 : 9)}
                  width={isFullscreen ? 60 : 48}
                  height={isFullscreen ? 24 : 18}
                  rx={5}
                  fill="#0f172a"
                  stroke={isFailed ? '#f43f5e' : '#475569'}
                  strokeWidth={1}
                />
                <text
                  x={(sx + tx) / 2}
                  y={(sy + ty) / 2 + (isFullscreen ? 5 : 4)}
                  textAnchor="middle"
                  fill={isFailed ? '#f43f5e' : '#38bdf8'}
                  fontSize={isFullscreen ? 12 : 10}
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
            const rRadius = isFullscreen ? (isSelected ? 22 : 18) : (isSelected ? 16 : 14);

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedEntity({ type: 'resource', data: n.data })}
                className="cursor-pointer group"
              >
                <circle
                  r={rRadius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : 2}
                  className="transition-all"
                />
                <text
                  textAnchor="middle"
                  dy={isFullscreen ? 5 : 4}
                  fill="#ffffff"
                  fontSize={isFullscreen ? 12 : 10}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {n.id}
                </text>
                <text
                  x={isFullscreen ? -30 : -22}
                  y={4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize={isFullscreen ? 12 : 10}
                  className="font-mono font-medium"
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
            const boxHalf = isFullscreen ? 18 : 14;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedEntity({ type: 'incident', data: n.data })}
                className="cursor-pointer group"
              >
                <rect
                  x={-boxHalf}
                  y={-boxHalf}
                  width={boxHalf * 2}
                  height={boxHalf * 2}
                  rx={isFullscreen ? 8 : 6}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : 2}
                  className="transition-all"
                />
                <text
                  textAnchor="middle"
                  dy={isFullscreen ? 5 : 4}
                  fill="#ffffff"
                  fontSize={isFullscreen ? 13 : 11}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {n.id}
                </text>
                <text
                  x={isFullscreen ? 28 : 22}
                  y={4}
                  textAnchor="start"
                  fill="#cbd5e1"
                  fontSize={isFullscreen ? 12 : 10}
                  className="font-mono font-medium"
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

import React, { useState } from 'react';

export default function HomePage({ onLaunch }) {
  const [launching, setLaunching] = useState(false);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => {
      onLaunch();
    }, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 transition-all duration-500 ${
        launching ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow behind logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/[0.07] blur-[120px] animate-pulse" />
        {/* Scanning line */}
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
          style={{
            animation: 'scanLine 4s ease-in-out infinite',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
        {/* Hackathon badge */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-950/60 text-indigo-300">
            Gateways 2026
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-slate-400">
            Domain 4
          </span>
        </div>

        {/* Pulsing logo */}
        <div className="relative mb-8">
          {/* Outer pulse ring */}
          <div className="absolute inset-0 -m-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 blur-md animate-pulse" />
          <div className="absolute inset-0 -m-1.5 rounded-xl border border-indigo-500/20 animate-pulse" />

          <div className="relative w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-600 p-0.5 shadow-lg shadow-indigo-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-3xl font-black tracking-tighter text-cyan-400 font-mono">
                CC
              </span>
            </div>
            {/* Emergency signal dot */}
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-950" />
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2">
          Crisis Command
        </h1>

        {/* Team */}
        <p className="text-sm font-mono font-semibold text-indigo-400 tracking-wider uppercase mb-6">
          Team Neural Ninjas
        </p>

        {/* Problem statement */}
        <div className="mb-4 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            Problem Statement
          </p>
          <p className="text-sm sm:text-base font-semibold text-slate-200 leading-relaxed">
            The Multi-Agent Emergency Response &amp; Resource Coordination Agent
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-lg">
          A multi-agent emergency response and resource coordination system for simulated crisis scenarios.
        </p>

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={launching}
          className="group relative overflow-hidden px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-indigo-600/30 transition-all duration-300 hover:shadow-cyan-500/40 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="relative flex items-center gap-2">
            <span>Launch Crisis Command</span>
            <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
          </span>
        </button>
      </div>

      {/* Safety banner at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-amber-950/40 border-t border-amber-500/30 px-4 py-2 text-center">
        <p className="text-[11px] font-mono font-semibold text-amber-300/80 uppercase tracking-wider">
          ⚠ Demonstration / Simulation Only — Not for Real-World Emergency Dispatch
        </p>
      </div>

      {/* Scanning line animation */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 15%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { top: 85%; }
        }
      `}</style>
    </div>
  );
}

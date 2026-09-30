import React, { useState, useEffect } from 'react';

export default function HomePage({ onLaunch }) {
  const [launching, setLaunching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Stagger entrance animations
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => onLaunch(), 700);
  };

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950 overflow-hidden transition-all duration-700 ease-out ${
        launching ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
      }`}
    >
      {/* === ANIMATED BACKGROUND === */}

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.6) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Radial glow — center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-indigo-600/[0.06] blur-[140px]" style={{ animation: 'breathe 6s ease-in-out infinite' }} />

      {/* Secondary glow — top right */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-[100px]" style={{ animation: 'breathe 8s ease-in-out infinite reverse' }} />

      {/* Horizontal scan line */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.25), transparent)',
          animation: 'scanDown 5s ease-in-out infinite',
        }}
      />

      {/* Vertical scan line */}
      <div
        className="absolute top-0 bottom-0 w-[1px] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.2), transparent)',
          animation: 'scanRight 7s ease-in-out infinite',
        }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-indigo-400/20 pointer-events-none"
          style={{
            width: `${3 + i * 1.5}px`,
            height: `${3 + i * 1.5}px`,
            left: `${15 + i * 14}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `float ${4 + i * 0.8}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}

      {/* === CONTENT === */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl">

        {/* Hackathon badge — fade in from top */}
        <div
          className={`mb-8 flex items-center gap-2.5 transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/60 text-indigo-300 shadow-sm shadow-indigo-500/10">
            Gateways 2026
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-slate-500">
            Domain 4
          </span>
        </div>

        {/* Logo — scale in */}
        <div
          className={`relative mb-10 transition-all duration-700 delay-200 ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          {/* Outer glow rings */}
          <div className="absolute inset-0 -m-5 rounded-2xl border border-indigo-500/10" style={{ animation: 'breathe 3s ease-in-out infinite' }} />
          <div className="absolute inset-0 -m-3 rounded-xl border border-cyan-500/15" style={{ animation: 'breathe 3s ease-in-out infinite 0.5s' }} />
          <div className="absolute inset-0 -m-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 blur-lg" style={{ animation: 'breathe 4s ease-in-out infinite' }} />

          <div className="relative w-[72px] h-[72px] rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-600 p-[2px] shadow-xl shadow-indigo-600/25">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-[28px] font-black tracking-tighter text-cyan-400 font-mono">
                CC
              </span>
            </div>
            {/* Emergency signal */}
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-slate-950" />
            </span>
          </div>
        </div>

        {/* Title — fade up */}
        <h1
          className={`text-5xl sm:text-6xl font-black text-white tracking-tight mb-2 transition-all duration-700 delay-300 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Crisis Command
        </h1>

        {/* Team name — fade up */}
        <p
          className={`text-sm font-mono font-semibold text-indigo-400 tracking-[0.25em] uppercase mb-8 transition-all duration-700 delay-[400ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Team Neural Ninjas
        </p>

        {/* Problem statement card — fade up */}
        <div
          className={`mb-3 w-full px-5 py-4 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm transition-all duration-700 delay-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1.5">
            Problem Statement
          </p>
          <p className="text-[15px] font-semibold text-slate-200 leading-relaxed">
            The Multi-Agent Emergency Response &amp; Resource Coordination Agent
          </p>
        </div>

        {/* Description — fade up */}
        <p
          className={`text-sm text-slate-500 leading-relaxed mb-10 max-w-md transition-all duration-700 delay-[600ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          A multi-agent emergency response and resource coordination system for simulated crisis scenarios.
        </p>

        {/* Launch button — fade up + scale */}
        <button
          onClick={handleLaunch}
          disabled={launching}
          className={`group relative overflow-hidden px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-sm tracking-[0.15em] uppercase shadow-lg shadow-indigo-600/25 transition-all duration-500 delay-700 hover:shadow-cyan-500/30 hover:shadow-xl hover:scale-[1.04] active:scale-[0.97] disabled:opacity-50 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Shimmer sweep */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span className="relative flex items-center gap-2.5">
            <span>{launching ? 'Launching...' : 'Launch Crisis Command'}</span>
            <span className="group-hover:translate-x-1 transition-transform duration-200 text-base">→</span>
          </span>
        </button>
      </div>

      {/* Safety banner — fixed bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-amber-950/30 border-t border-amber-500/20 px-4 py-2.5 text-center">
        <p className="text-[10px] font-mono font-semibold text-amber-400/70 uppercase tracking-[0.15em]">
          ⚠ Demonstration / Simulation Only — Not for Real-World Emergency Dispatch
        </p>
      </div>

      {/* === KEYFRAME ANIMATIONS === */}
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes scanDown {
          0% { top: 5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
        @keyframes scanRight {
          0% { left: 5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 95%; opacity: 0; }
        }
        @keyframes float {
          0% { transform: translateY(0px) scale(1); opacity: 0.2; }
          100% { transform: translateY(-20px) scale(1.3); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

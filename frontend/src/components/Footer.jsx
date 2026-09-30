import React from 'react';
import { useRouter } from '../router/Router';

export default function Footer() {
  const { navigate } = useRouter();

  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-400 font-sans">
      {/* Mandatory Safety Notice Strip */}
      <div className="bg-amber-950/40 border-b border-amber-600/30 px-4 py-2.5 text-center text-xs text-amber-200/90 font-mono tracking-wide flex items-center justify-center gap-2">
        <span className="text-amber-400 text-sm">⚠️</span>
        <span className="font-semibold uppercase tracking-wider text-amber-300">
          DEMONSTRATION / SIMULATION ONLY:
        </span>
        <span>
          NOT FOR REAL-WORLD EMERGENCY DISPATCH. Designed strictly for research, benchmarking, and hackathon evaluation.
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center font-black text-xs text-white">
                CC
              </div>
              <span className="text-base font-bold text-white tracking-wider font-mono uppercase">
                Crisis Command
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Autonomous multi-agent emergency response orchestrator with dynamic rerouting, real-time replanning, and immutable human-in-the-loop safety governance.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>119/119 Deterministic Invariant Tests Passing</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold mb-3">
              Application &amp; Ops
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/app')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  Live Command Center Cockpit
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/demo')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  Interactive Scenario Walkthrough
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  System Overview &amp; Capabilities
                </button>
              </li>
            </ul>
          </div>

          {/* Technical Docs */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold mb-3">
              Architecture &amp; Docs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/docs')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  Multi-Agent Consensus Architecture
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/docs')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  FastAPI REST Engine &amp; State API
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/docs')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  Safety Invariants &amp; Approval Gate
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/about')}
                  className="hover:text-cyan-400 transition-colors text-left"
                >
                  Design Philosophy &amp; Why It Exists
                </button>
              </li>
            </ul>
          </div>

          {/* Repository & Stack */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold mb-3">
              Source &amp; Verification
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/vishalm111/Crisis_Command_Hackathon.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                >
                  <span>GitHub Repository</span>
                  <span>↗</span>
                </a>
              </li>
              <li className="text-[11px] text-slate-500 font-mono">
                FastAPI · React 19 · Tailwind v4 · Leaflet
              </li>
              <li className="text-[11px] text-slate-500 font-mono">
                Pydantic v2 Invariants · Isolated Memory What-If
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Crisis Command. Engineered for AI Crisis Response Hackathon.</p>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              BUILD: v2.4.0-STABLE
            </span>
            <span className="text-slate-600">|</span>
            <span>HUMAN-IN-THE-LOOP ACTIVE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

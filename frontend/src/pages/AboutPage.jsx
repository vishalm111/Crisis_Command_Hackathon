import React from 'react';
import { useRouter } from '../router/Router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function AboutPage() {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-16">
        {/* Title Block */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-4">
            <span>🏛️</span>
            <span>MISSION &amp; PHILOSOPHY</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            About Crisis Command
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            Re-architecting urban disaster management through explainable, resilient, and human-governed multi-agent AI systems.
          </p>
        </div>

        {/* Mandatory Safety Notice */}
        <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-900/50 text-amber-400 text-2xl flex items-center justify-center shrink-0">
            ⚠️
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 font-mono">
              Operational Safety Protocol &amp; Legal Stance
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Crisis Command is strictly a research, benchmarking, and demonstration platform engineered for hackathons and academic simulations. It is <strong>NOT</strong> certified for live emergency 911 dispatch and must never replace official municipal dispatch software.
            </p>
          </div>
        </div>

        {/* Why Crisis Command Exists */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">#</span>
            <span>Why We Built Crisis Command</span>
          </h2>
          <div className="prose prose-invert text-slate-300 text-sm leading-relaxed space-y-3">
            <p>
              In contemporary municipal emergencies, dispatchers rely on legacy Computer-Aided Dispatch (CAD) software designed in the 1990s. When a routine single-alarm incident occurs, these systems assign the nearest available engine or ambulance based on simple Euclidean or static street distance.
            </p>
            <p>
              However, when a major crisis strikes — a chemical plant explosion during an earthquake, an escalating multi-front wildfire, or flash floods cutting through city arterials — single incidents cascade into interdependent disasters. Ambulances get trapped behind flooded bridges. Fire engines run out of water pressure because a nearby hydrant main burst. Hospitals experience sudden mass-casualty ER gridlock.
            </p>
            <p>
              Human dispatchers become rapidly overwhelmed by the sheer volume of conflicting variables. Conversely, naive "pure autonomous AI" dispatchers are dangerous because LLMs hallucinate, lack physical spatial constraints, and cannot be held legally accountable for human lives.
            </p>
            <p className="text-cyan-300 font-medium">
              Crisis Command was engineered to bridge this divide: combining the sub-second speed and constraint-satisfaction prowess of autonomous multi-agent consensus with the non-negotiable moral authority and veto power of a human commander.
            </p>
          </div>
        </section>

        {/* Core Architectural Pillars */}
        <section className="space-y-6">
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">#</span>
            <span>The Four Foundational Pillars</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-cyan-400 font-mono text-xs font-bold uppercase">
                Pillar 1
              </div>
              <h3 className="text-lg font-bold text-white">
                Multi-Agent Specialization &amp; Consensus
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rather than relying on a single monolithic prompt, Crisis Command distributes responsibilities across 4 discrete subagents: Triage Assessment, Resource Routing, Safety Invariants, and Explanation Synthesis. Agents negotiate optimal trade-offs in sub-second cycles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-emerald-400 font-mono text-xs font-bold uppercase">
                Pillar 2
              </div>
              <h3 className="text-lg font-bold text-white">
                Deterministic Invariants Over LLM Vibes
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Safety is never left to generative LLM temperature. All generated dispatch plans must pass 119 deterministic software invariants verified by rigorous Python state engines before they can even be proposed to an operator.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-amber-400 font-mono text-xs font-bold uppercase">
                Pillar 3
              </div>
              <h3 className="text-lg font-bold text-white">
                Cryptographic Human-in-the-Loop Gate
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                High-stakes Tier-3/Tier-4 dispatches physically halt execution until a human dispatcher clicks "Approve". If rejected, the system dynamically generates safe fallback contingencies without stalling ongoing operations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-purple-400 font-mono text-xs font-bold uppercase">
                Pillar 4
              </div>
              <h3 className="text-lg font-bold text-white">
                Isolated Memory Counterfactuals
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Commanders can branch parallel hypothetical futures ("What if Engine 2 is diverted?", "What if Bridge 4 collapses?") in isolated memory sandboxes to foresee second-order consequences without mutating live operations.
              </p>
            </div>
          </div>
        </section>

        {/* CAD Comparison Table */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">#</span>
            <span>Traditional CAD vs. Crisis Command</span>
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-300 font-mono uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Capability</th>
                  <th className="p-3">Traditional CAD</th>
                  <th className="p-3 text-cyan-400">Crisis Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="p-3 font-semibold text-white">Routing Strategy</td>
                  <td className="p-3 text-slate-400">Static Euclidean / Nearest available</td>
                  <td className="p-3 text-cyan-300">Dynamic multi-vehicle vectoring with live obstacle avoidance</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Cascading Failure Awareness</td>
                  <td className="p-3 text-slate-400">None (independent single tickets)</td>
                  <td className="p-3 text-cyan-300">Directed dependency graphs &amp; 30/60/90-min predictive modeling</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">What-If Branching</td>
                  <td className="p-3 text-slate-400">Impossible without corrupting state</td>
                  <td className="p-3 text-cyan-300">Isolated memory deep-clone simulation sandbox</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Decision Auditability</td>
                  <td className="p-3 text-slate-400">Basic timestamp log</td>
                  <td className="p-3 text-cyan-300">Causality scrubber with exact plan diffs &amp; agent reasoning traces</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Human Governance</td>
                  <td className="p-3 text-slate-400">Manual dispatcher bottleneck</td>
                  <td className="p-3 text-cyan-300">Selective human approval gate for Tier-3/4 life-critical decisions</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Call to action */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/40 text-center space-y-4">
          <h3 className="text-2xl font-bold text-white">
            Inspect the Running Implementation
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Experience how Crisis Command handles cascading failures in real time. Launch the operations cockpit or explore our comprehensive technical docs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/app')}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30"
            >
              Launch Live Command Center →
            </button>
            <button
              onClick={() => navigate('/docs')}
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold"
            >
              View API &amp; Technical Docs
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

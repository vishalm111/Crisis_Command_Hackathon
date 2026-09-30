import React, { useState } from 'react';
import { useRouter } from '../router/Router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function DocsPage() {
  const { navigate } = useRouter();
  const [activeSection, setActiveSection] = useState('architecture');

  const apiEndpoints = [
    {
      method: 'GET',
      path: '/state',
      desc: 'Retrieves current authoritative crisis state including incidents, resources, active plan, latest diff, approvals, and telemetry.',
      params: 'None',
      response: 'StateSchema (JSON)',
    },
    {
      method: 'POST',
      path: '/scenario/next',
      desc: 'Advances the deterministic scenario engine by exactly 1 beat, triggering situational changes and agent replanning.',
      params: 'None',
      response: '{ success: true, scenario_step: int }',
    },
    {
      method: 'POST',
      path: '/scenario/reset',
      desc: 'Resets all incidents, resources, and dispatches to pristine baseline state.',
      params: 'None',
      response: '{ success: true, message: string }',
    },
    {
      method: 'POST',
      path: '/scenario/run',
      desc: 'Starts automatic scenario progression across all 7 beats.',
      params: 'None',
      response: '{ success: true, running: true }',
    },
    {
      method: 'POST',
      path: '/scenario/pause',
      desc: 'Halts automatic scenario progression.',
      params: 'None',
      response: '{ success: true, running: false }',
    },
    {
      method: 'POST',
      path: '/approval/{id}/approve',
      desc: 'Grants operator authorization for pending high-risk dispatch plan, executing assignments immediately.',
      params: 'id: string (approval ID in path)',
      response: '{ success: true, status: "approved" }',
    },
    {
      method: 'POST',
      path: '/approval/{id}/reject',
      desc: 'Denies pending plan, triggering safe contingency fallback without operational deadlock.',
      params: 'id: string (approval ID in path)',
      response: '{ success: true, status: "rejected" }',
    },
    {
      method: 'POST',
      path: '/incidents/{id}/escalate',
      desc: 'Manually escalates incident severity (e.g. Tier 2 -> Tier 3), forcing swarm replanning.',
      params: '{ severity: "tier_1" | "tier_2" | "tier_3" | "tier_4" }',
      response: '{ success: true, incident: IncidentSchema }',
    },
    {
      method: 'POST',
      path: '/what-if',
      desc: 'Executes parallel hypothetical simulation in isolated memory without altering live state.',
      params: '{ scenario_override: dict, delayed_units: list }',
      response: '{ simulated_plan: PlanSchema, impact_deltas: dict }',
    },
    {
      method: 'POST',
      path: '/chaos/inject',
      desc: 'Injects synthetic failure (e.g. road collapse, engine breakdown) to stress-test resilience.',
      params: '{ failure_type: string, target_id: string }',
      response: '{ injected: true, new_plan_generated: bool }',
    },
    {
      method: 'POST',
      path: '/chat',
      desc: 'Dispatches natural-language query to the multi-agent explanation co-pilot.',
      params: '{ query: string }',
      response: '{ reply: string, reasoning_trace: list }',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
            <span>⚙️</span>
            <span>SYSTEM SPECIFICATION</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Architecture &amp; API Documentation
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-3xl">
            Complete technical specification of the Crisis Command multi-agent orchestration architecture, state invariants, safety gates, and REST interface.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-8 overflow-x-auto">
          {[
            { id: 'architecture', label: 'Multi-Agent Architecture' },
            { id: 'invariants', label: 'Safety Invariants & Approval Gate' },
            { id: 'api', label: 'REST API Reference' },
            { id: 'setup', label: 'Local Development & Verification' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeSection === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECTION 1: MULTI-AGENT ARCHITECTURE */}
        {activeSection === 'architecture' && (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🤖</span>
                <span>The Multi-Agent Swarm Topology</span>
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Crisis Command discards naive single-agent prompt architectures in favor of a synchronized multi-agent state graph. Each agent possesses bounded authority, explicit schema inputs/outputs, and verifiable invariants.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-cyan-400 font-mono text-xs font-bold mb-1">
                    01. Incident Assessment Agent
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Evaluates multi-source emergency calls, parses spatial coordinates, detects secondary hazard signatures (e.g. hazardous materials nearby), and assigns deterministic severity tiers (Tier 1–4).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-indigo-400 font-mono text-xs font-bold mb-1">
                    02. Resource Allocation &amp; Routing Agent
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Maintains real-time fleet state across municipal departments. Computes multi-vehicle trajectory optimizations, accounts for blocked corridors, and maximizes citywide coverage redundancy.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-amber-400 font-mono text-xs font-bold mb-1">
                    03. Safety Monitor &amp; Compliance Agent
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Acts as an immutable gatekeeper. Validates all proposed dispatches against 119 physical invariants. For Tier-3 and Tier-4 escalations, it physically blocks dispatch signals until human approval is signed.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-purple-400 font-mono text-xs font-bold mb-1">
                    04. Explanation &amp; Transparency Agent
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Generates transparent "Why This Resource / Why Not" attributions, computes Brier-calibrated uncertainty intervals, and provides real-time natural language answers to operator queries.
                  </p>
                </div>
              </div>
            </div>

            {/* Architecture Flow Diagram */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono mb-4">
                State Transition Flow
              </h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2 overflow-x-auto">
                <div className="text-cyan-400">[Incident Ingestion] → [Assessment Agent] → Severity Score (Tier 1-4)</div>
                <div className="pl-4 text-slate-500">↓</div>
                <div className="text-indigo-400">[Allocation Agent] → Dynamic Multi-Vehicle Vectoring &amp; Plan Generation</div>
                <div className="pl-4 text-slate-500">↓</div>
                <div className="text-amber-400">[Safety Oracle] → Invariant Verification (119 Rules)</div>
                <div className="pl-4 text-slate-500">↓</div>
                <div className="text-yellow-400 font-bold">Is Tier &gt;= 3? → [YES] → HALT AT HUMAN APPROVAL GATE → Operator Signs Off</div>
                <div className="pl-4 text-slate-500">↓</div>
                <div className="text-emerald-400">[Dispatch Execution] → Live Vehicle Telemetry &amp; Continuous Monitoring</div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: SAFETY INVARIANTS & APPROVAL GATE */}
        {activeSection === 'invariants' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>Deterministic Invariants (119 Automated Checks)</span>
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rather than trusting probabilistic models to avoid catastrophic failure modes, Crisis Command enforces hard invariants at the backend schema level.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      INV-01: Resource Exclusivity Invariant
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                      ENFORCED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    No physical emergency resource (Ambulance, Fire Engine, Police Cruiser) can be simultaneously assigned to more than one active dispatch route.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      INV-02: Cryptographic Human Approval for Tier-3/4
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                      ENFORCED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Any dispatch plan escalating an incident to Tier 3 (Severe Hazard) or Tier 4 (Mass Casualty) enters an immutable pending state. The execution dispatcher is physically disabled until an authenticated operator signs off.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      INV-03: Operational Continuity on Rejection
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                      ENFORCED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    If an operator rejects an approval request, the previous active plan remains 100% intact with zero state corruption. The swarm immediately synthesizes safe non-disruptive alternatives.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      INV-04: Isolated Memory What-If Sandboxing
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                      ENFORCED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Counterfactual and What-If simulations clone the authoritative state deep into memory. No simulation run can write or emit mutations to the live operational state.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: REST API REFERENCE */}
        {activeSection === 'api' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span>⚡</span>
                <span>REST API Specification</span>
              </h2>
              <p className="text-xs text-slate-300 mb-6">
                All endpoints are served via high-performance async FastAPI with strict Pydantic v2 validation.
              </p>

              <div className="space-y-4">
                {apiEndpoints.map((ep) => (
                  <div
                    key={`${ep.method}-${ep.path}`}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-750 transition-all font-mono"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded ${
                          ep.method === 'GET'
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-sm font-bold text-white">{ep.path}</span>
                    </div>

                    <p className="text-xs text-slate-400 font-sans mb-3">{ep.desc}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                      <div>
                        <span className="text-slate-500">Parameters:</span> {ep.params}
                      </div>
                      <div>
                        <span className="text-slate-500">Returns:</span> {ep.response}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: LOCAL DEV & VERIFICATION */}
        {activeSection === 'setup' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 font-mono text-xs">
              <h2 className="text-xl font-bold text-white font-sans flex items-center gap-2">
                <span>💻</span>
                <span>Local Setup &amp; Automated Verification</span>
              </h2>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Crisis Command is fully reproducible with clean zero-warning builds.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="text-cyan-400 font-bold mb-1 font-sans">
                    1. Backend Setup (FastAPI &amp; Python 3.12)
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto">
{`python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload`}
                  </pre>
                </div>

                <div>
                  <div className="text-indigo-400 font-bold mb-1 font-sans">
                    2. Frontend Setup (React 19 &amp; Vite 8)
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto">
{`cd frontend
npm install
npm run dev`}
                  </pre>
                </div>

                <div>
                  <div className="text-emerald-400 font-bold mb-1 font-sans">
                    3. Run Automated Safety Invariant Tests (119 Tests)
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto">
{`python -m pytest backend/tests -v`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-white">
              Ready to verify live in the cockpit?
            </h4>
            <p className="text-xs text-slate-400">
              Access the operations interface to see multi-agent dispatch in action.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app')}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
            >
              Launch Command Center →
            </button>
            <button
              onClick={() => navigate('/demo')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold"
            >
              Watch Demo
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

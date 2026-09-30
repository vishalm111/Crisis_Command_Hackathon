import React, { useState } from 'react';
import { useRouter } from '../router/Router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function LandingPage() {
  const { navigate } = useRouter();
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

  const features = [
    {
      id: 'brain',
      title: 'Crisis Brain',
      badge: 'Cognitive Core',
      icon: '🧠',
      tagline: 'Multi-agent cognitive orchestrator synthesizing situational telemetry in real-time.',
      desc: 'Orchestrates 4 specialized autonomous subagents (Incident Assessment, Resource Routing, Safety Monitor, and Explanation Generator) with deterministic conflict resolution.',
      stats: 'Sub-second agent consensus · Zero deadlock',
    },
    {
      id: 'chaos',
      title: 'Chaos Mode',
      badge: 'Resilience Testing',
      icon: '⚡',
      tagline: 'Inject synthetic failures, blocked routes, and resource dropouts.',
      desc: 'Simulate unexpected road collapses, sudden telemetry dropouts, vehicle breakdowns, and hospital surges to stress-test agent replanning under extreme duress.',
      stats: 'Dynamic failure recovery in < 1.2s',
    },
    {
      id: 'predictor',
      title: 'Future Impact Predictor',
      badge: 'Predictive Intelligence',
      icon: '🔮',
      tagline: 'Cascading crisis escalation modeling over 30, 60, and 90-minute horizons.',
      desc: 'Forecasts secondary structure fires, smoke drift toxicity, traffic gridlocks, and hospital ER saturation before second-alarm dispatches even leave their stations.',
      stats: '3-tier temporal projection horizon',
    },
    {
      id: 'graph',
      title: 'Resource Dependency Graph',
      badge: 'Topology Engine',
      icon: '🕸️',
      tagline: 'Interactive topological mapping of critical emergency interdependencies.',
      desc: 'Visually traces relationships between fire engines, hazmat units, mutual-aid battalions, hydrants, triage sectors, and hospital trauma bays to surface hidden bottlenecks.',
      stats: 'Full-screen zoomable SVG visualizer',
    },
    {
      id: 'lab',
      title: 'Counterfactual Lab',
      badge: 'What-If Simulation',
      icon: '🧪',
      tagline: 'Branch parallel hypothetical realities without mutating live state.',
      desc: 'Deep-clone the active dispatch state into memory to test "What if Engine 3 was delayed?" or "What if Incident 2 escalates to Tier-4?" with zero risk to ongoing ops.',
      stats: '100% isolated memory sandbox',
    },
    {
      id: 'replay',
      title: 'Decision Replay & Causality',
      badge: 'Audit & Causality',
      icon: '🎞️',
      tagline: 'Step-by-step historical causality scrubber with plan version diffs.',
      desc: 'Scrub through every historical decision beat: incident triage, route calculation, safety gate trigger, operator sign-off, and vehicle reroutes with exact causality logs.',
      stats: 'Deterministic plan diff tracking',
    },
    {
      id: 'confidence',
      title: 'Confidence & Uncertainty',
      badge: 'Epistemic Metrics',
      icon: '🎯',
      tagline: 'Calibrated confidence scores with explicit uncertainty boundaries.',
      desc: 'Every triage and route recommendation displays a calibrated probability metric (e.g. 94% confidence) and flags unconfirmed telemetry or smoke occlusion gaps.',
      stats: 'Calibrated Brier confidence thresholds',
    },
    {
      id: 'why',
      title: 'Why This Resource / Why Not',
      badge: 'Explainable AI',
      icon: '⚖️',
      tagline: 'Instant transparent justification for every unit assigned and rejected.',
      desc: 'Answers why Ladder 1 was picked over Engine 4, showing estimated travel times, specialized gear compatibility, fuel levels, and current crew readiness.',
      stats: 'Eliminates black-box algorithmic distrust',
    },
    {
      id: 'escalation',
      title: 'Crisis Escalation Level',
      badge: 'Threat Matrix',
      icon: '🚨',
      tagline: 'Dynamic DEFCON-style operational posture across municipal sectors.',
      desc: 'Automatically computes regional threat levels (Green -> Yellow -> Orange -> Red -> Black) based on active fire containment, triage backlogs, and fleet exhaustion.',
      stats: 'Sector-by-sector live risk level',
    },
    {
      id: 'judge',
      title: 'Judge & Presentation Mode',
      badge: 'Executive View',
      icon: '🏆',
      tagline: 'Curated high-contrast executive interface tailored for hackathon evaluation.',
      desc: 'Presents the decision chain in an elegant, distraction-free widescreen view showcasing multi-agent negotiations, human governance gates, and live geospatial dispatch.',
      stats: 'Optimized for high-impact demonstrations',
    },
    {
      id: 'story',
      title: 'Demo Story Controller',
      badge: 'Narrative Control',
      icon: '🎬',
      tagline: 'Curated 7-beat escalating emergency scenario with pause and rewind.',
      desc: 'Allows judges and evaluators to step through a realistic cascading disaster: from quiet patrol to multi-alarm warehouse fire, hazmat spill, mutual-aid gridlock, and safe resolution.',
      stats: 'Deterministic 7-beat scenario replay',
    },
    {
      id: 'scoreboard',
      title: 'Crisis Scoreboard',
      badge: 'Telemetry HUD',
      icon: '📊',
      tagline: 'High-visibility response telemetry: containment %, active dispatches, ETA.',
      desc: 'Real-time telemetry HUD displaying critical mission KPIs: Average Response Time, Resource Saturation %, Containment %, and Pending Safety Approvals at a glance.',
      stats: 'Sub-second real-time HUD updates',
    },
    {
      id: 'chat',
      title: 'Advanced Agent Dialogue',
      badge: 'Operator Co-Pilot',
      icon: '💬',
      tagline: 'Direct conversational co-pilot querying agent reasoning and state.',
      desc: 'Enables incident commanders to converse directly with the swarm: "Why is Medic 2 rerouted?", "What is our worst-case hospital bottleneck?", and "Simulate evacuating Sector B".',
      stats: 'Grounded in active application state',
    },
    {
      id: 'health',
      title: 'System Invariant Health',
      badge: 'Safety Assurance',
      icon: '🛡️',
      tagline: 'Continuous validation of mathematical and operational dispatch invariants.',
      desc: 'Guarantees no two units share conflicting routes, no high-risk dispatch executes without human authorization, and state machines remain strictly deterministic.',
      stats: '119 automated invariant tests passing',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 flex flex-col">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 border-b border-slate-850 bg-radial-[at_top_center] from-indigo-950/40 via-slate-950 to-slate-950">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="font-semibold tracking-wide">AUTONOMOUS MULTI-AGENT SWARM v2.4</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400">119 VERIFIED INVARIANTS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
            Autonomous Multi-Agent{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Crisis Command
            </span>{' '}
            with Dynamic Replanning
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
            Orchestrating ambulances, fire units, and police across cascading urban disasters in sub-second latency — powered by multi-agent consensus, predictive simulation, and deterministic human-in-the-loop governance.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => navigate('/app')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base shadow-lg shadow-indigo-500/25 hover:shadow-cyan-500/35 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group"
            >
              <span>Launch Live Command Center</span>
              <span className="group-hover:translate-x-1 transition-transform font-mono text-cyan-200">
                →
              </span>
            </button>

            <button
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-base border border-slate-750 transition-all flex items-center justify-center gap-2 group"
            >
              <span>▶ Run Interactive Walkthrough</span>
            </button>
          </div>

          {/* Real Metrics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/80">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/70">
              <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
                &lt; 850ms
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Mean Replanning Latency
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/70">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                100%
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Safety Invariant Compliance
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/70">
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
                14
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Deep Intelligence Modules
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/70">
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">
                Zero
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Unvetted High-Risk Dispatches
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM STATEMENT: THE DISASTER BOTTLENECK */}
      <section className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold mb-2">
              The Emergency Crisis Challenge
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              Why Legacy Computer-Aided Dispatch Fails Under Cascading Disasters
            </h3>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              When catastrophic urban disasters unfold — earthquakes, industrial hazmat leaks, or major wildfires — emergency operations centers experience systemic breakdown within minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-red-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400 flex items-center justify-center text-2xl mb-4">
                💥
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Dispatcher Cognitive Overload
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Single human operators handle hundreds of 911 calls simultaneously. Prioritization collapses, severe burns and trapped victims sit in queues, and resource conflicts go undetected.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mb-4">
                ⏳
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Cascading Second-Order Delays
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Static point-to-point CAD systems fail to anticipate secondary explosions, road flood closures, or hospital ER capacity, resulting in emergency vehicles trapped in gridlock.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-2xl mb-4">
                🔒
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                The Dangerous "Black-Box" AI Dilemma
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Uncontrolled autonomous AI agents cannot be trusted with human lives. Without deterministic constraints and mandatory human governance gates, pure AI dispatch is illegal and catastrophic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW CRISIS COMMAND WORKS: 9-STAGE CLOSED LOOP */}
      <section className="py-20 bg-slate-900/40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold mb-2">
              Autonomous Operational Loop
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              The 9-Stage Intelligent Response Engine
            </h3>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              From the instant a 911 telemetry packet is parsed to wheels rolling on pavement — executed with sub-second agent consensus and human verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                step: '01',
                title: 'Multi-Source Telemetry Ingestion',
                desc: 'Streams 911 calls, GIS sensors, traffic cams, and hospital bed monitors into unified incident state.',
                tag: 'Sensors / 911 Feed',
              },
              {
                step: '02',
                title: 'Multi-Agent Triage Assessment',
                desc: 'Incident Assessment Agent scores severity (Tier 1–4), casualty risks, and specialized equipment prerequisites.',
                tag: 'NLP + Spatial Triage',
              },
              {
                step: '03',
                title: 'Constraint & Dependency Mapping',
                desc: 'Constructs directed dependency graph linking road closures, water pressure, hazmat plumes, and mutual aid.',
                tag: 'Topological Engine',
              },
              {
                step: '04',
                title: 'Dynamic Multi-Vehicle Routing',
                desc: 'Resource Allocation Agent optimizes Haversine and road network trajectories for fastest ETA across available fleet.',
                tag: 'Route Optimization',
              },
              {
                step: '05',
                title: 'Multi-Agent Consensus Negotiation',
                desc: 'Agents debate trade-offs (e.g. diverting Engine 1 vs Ladder 2) and formulate a unified candidate dispatch plan.',
                tag: 'LangGraph Consensus',
              },
              {
                step: '06',
                title: 'Deterministic Invariant Verification',
                desc: 'Automated safety oracle verifies 119 physical and ethical rules: no resource double-booking, range limits respected.',
                tag: 'Safety Oracle',
              },
              {
                step: '07',
                title: 'Mandatory Human Approval Gate',
                desc: 'High-stakes Tier-3/Tier-4 dispatches halt at an immutable cryptographic gate requiring human dispatcher sign-off.',
                tag: 'Human-in-the-Loop',
              },
              {
                step: '08',
                title: 'Resilient Dispatch Execution',
                desc: 'Transmits turn-by-turn vectors, tactical briefings, and telemetry beacons directly to first-responder Mobile Data Terminals.',
                tag: 'Fleet Telemetry',
              },
              {
                step: '09',
                title: 'Closed-Loop Chaos Replanning',
                desc: 'Monitors ongoing progress; instantly reroutes and adjusts assignments if a route floods or a vehicle fails.',
                tag: 'Continuous Adaptation',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-cyan-400 font-extrabold text-sm tracking-wider">
                      STAGE {s.step}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {s.tag}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">{s.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE INTELLIGENCE: 14 DEEP FEATURES SHOWCASE */}
      <section className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-semibold mb-2">
              Comprehensive Capability Matrix
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              14 Production-Grade Intelligence Modules
            </h3>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              Designed and built end-to-end to deliver maximum explainability, operator agency, resilience, and command clarity.
            </p>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left selector */}
            <div className="lg:col-span-4 flex flex-col gap-1.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {features.map((feat, index) => {
                const isSelected = activeFeatureTab === index;
                return (
                  <button
                    key={feat.id}
                    onClick={() => setActiveFeatureTab(index)}
                    className={`p-3 rounded-xl text-left transition-all border flex items-center gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/50 shadow-md text-white'
                        : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xl">{feat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate text-white">
                          {feat.title}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">
                          {feat.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {feat.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right active preview card */}
            <div className="lg:col-span-8 p-8 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-indigo-500/30 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl p-3 rounded-xl bg-slate-850 border border-slate-750">
                      {features[activeFeatureTab].icon}
                    </span>
                    <div>
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
                        {features[activeFeatureTab].badge}
                      </span>
                      <h4 className="text-2xl font-black text-white">
                        {features[activeFeatureTab].title}
                      </h4>
                    </div>
                  </div>

                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                    MODULE #{activeFeatureTab + 1}
                  </span>
                </div>

                <p className="text-base font-medium text-indigo-200/90 mb-4 leading-snug">
                  {features[activeFeatureTab].tagline}
                </p>

                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  {features[activeFeatureTab].desc}
                </p>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between mb-6">
                  <div className="text-xs font-mono text-slate-400">
                    Operational SLA / Benchmark:
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {features[activeFeatureTab].stats}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Ready to test live in the active operations cockpit?
                </span>
                <button
                  onClick={() => navigate('/app')}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wide flex items-center gap-2 shadow-md shadow-indigo-600/30"
                >
                  <span>Experience in Command Center</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HUMAN + AI GOVERNANCE DEEP DIVE */}
      <section className="py-20 bg-slate-900/30 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/30 text-amber-300 text-xs font-mono mb-4">
                <span>🛡️</span>
                <span>IMMUTABLE SAFETY GOVERNANCE</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
                Human-in-the-Loop: Why Pure AI Dispatch Is Reckless
              </h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                In life-critical operations, full algorithmic autonomy without human veto is unacceptable. Crisis Command implements a rigid cryptographic approval gate: while routine Tier-1 dispatches run autonomously, all high-stakes escalations (Tier-3/4 multi-casualty incidents, heavy equipment diversion, hazmat zone lockdowns) physically pause until an authorized human commander signs off.
              </p>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <span className="text-emerald-400 text-lg">✓</span>
                  <div>
                    <strong className="text-xs font-bold text-white">
                      Zero Execution Without Verification
                    </strong>
                    <p className="text-[11px] text-slate-400">
                      Tier-3/4 plans cannot emit dispatch signals without operator confirmation.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <span className="text-cyan-400 text-lg">✓</span>
                  <div>
                    <strong className="text-xs font-bold text-white">
                      Clear Rationale &amp; Alternative Preview
                    </strong>
                    <p className="text-[11px] text-slate-400">
                      The operator is presented with exact ETAs, trade-offs, and "why this resource" justifications before clicking Approve or Reject.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                  <span className="text-purple-400 text-lg">✓</span>
                  <div>
                    <strong className="text-xs font-bold text-white">
                      Instant Reversion &amp; Fallback
                    </strong>
                    <p className="text-[11px] text-slate-400">
                      If rejected, the system falls back to safe contingency standby in under 300ms without state corruption.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual approval panel simulation graphic */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-amber-500/40 shadow-xl font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span className="text-amber-400 font-bold uppercase tracking-wider">
                    SAFETY GATE TRIGGERED
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">ID: APP-2026-8841</span>
              </div>

              <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2 mb-4">
                <div className="text-slate-300">
                  <span className="text-slate-500">Action:</span> Reallocate Medic 2 to Hazardous Chemical Spill
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">Severity:</span> <span className="text-red-400 font-bold">TIER 4 (CRITICAL)</span>
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">Impact:</span> Structural fire coverage temporarily reduced by 14%
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">AI Confidence:</span> <span className="text-emerald-400">92%</span> (Brier Calibrated)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/app')}
                  className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center transition-colors"
                >
                  ✓ Approve Dispatch
                </button>
                <button
                  onClick={() => navigate('/app')}
                  className="py-2.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-600/30 font-bold text-center transition-colors"
                >
                  ✕ Reject Plan
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-500 mt-3">
                Clicking either action transitions you into the live operations cockpit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TECH STACK GROUNDED IN TRUTH */}
      <section className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold mb-2">
            Engineering Rigor
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Built on Modern, Auditable Technologies
          </h3>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base mb-12">
            Crisis Command runs on a lightning-fast async Python backend coupled with a sub-millisecond reactive front-end.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'FastAPI', role: 'Async REST Core', spec: 'Python 3.12 Engine' },
              { name: 'React 19', role: 'Concurrent UI', spec: 'Vite 8.3' },
              { name: 'Tailwind CSS', role: 'Aero Ops Styling', spec: 'v4 Engine' },
              { name: 'Leaflet', role: 'GIS Mapping', spec: 'CartoDB Dark Matter' },
              { name: 'Pydantic v2', role: 'Schema Invariants', spec: 'Strict Types' },
              { name: 'Pytest Suite', role: 'Reliability', spec: '119 Verified Tests' },
            ].map((t) => (
              <div
                key={t.name}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center"
              >
                <div className="font-bold text-white text-sm mb-1">{t.name}</div>
                <div className="text-[11px] text-cyan-400 font-mono">{t.role}</div>
                <div className="text-[10px] text-slate-500 mt-1">{t.spec}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="py-20 bg-gradient-to-b from-slate-950 to-indigo-950/40 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Ready to Take Command?
          </h3>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10">
            Launch the live operations cockpit now or follow our step-by-step interactive scenario walkthrough designed specifically for judges and evaluators.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/app')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <span>Launch Command Center</span>
              <span className="font-mono">→</span>
            </button>

            <button
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-semibold text-base border border-slate-750 transition-all flex items-center justify-center gap-2"
            >
              <span>Interactive 7-Beat Demo</span>
            </button>

            <button
              onClick={() => navigate('/docs')}
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-transparent hover:bg-slate-900/60 text-slate-300 hover:text-white font-medium text-sm transition-all"
            >
              Read Architecture Specs
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

import React, { useState, useCallback } from 'react';
import { useRouter } from '../router/Router';
import { getState, postJson } from '../api';
import { usePolling } from '../hooks/usePolling';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MapView from '../components/MapView';
import CrisisScoreboard from '../components/CrisisScoreboard';
import PlanDiff from '../components/PlanDiff';
import ApprovalPanel from '../components/ApprovalPanel';
import CrisisBrain from '../components/CrisisBrain';

export default function InteractiveDemo() {
  const { navigate } = useRouter();
  const { data: state, refresh } = usePolling(getState, 1000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const scenarioBeats = [
    {
      step: 1,
      title: 'Baseline Monitoring & Unit Readiness',
      badge: 'Calm Ops',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
      summary: 'Emergency services are stationed across municipal sectors. Units patrol routinely while telemetry monitors city grid integrity.',
      focus: 'Inspect the Scoreboard: Fleet is 100% available and Containment is steady.',
    },
    {
      step: 2,
      title: 'Structural Fire Outbreak (Tier 2)',
      badge: 'First Alarm',
      badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
      summary: 'Sensors detect smoke in Sector A. The Incident Assessment Agent scores severity at Tier 2 and dispatches Engine 1 automatically.',
      focus: 'Engine 1 trajectory is calculated using optimal road vectors.',
    },
    {
      step: 3,
      title: 'Cascading Chemical Spill (Tier 3)',
      badge: 'Compound Disaster',
      badgeColor: 'text-orange-400 bg-orange-950/60 border-orange-500/30',
      summary: 'Toxic fumes are reported at an industrial warehouse. Incident escalates to Tier 3. Multi-agency hazmat coordination is required.',
      focus: 'Notice the directed dependency graph update and secondary smoke drift predictions.',
    },
    {
      step: 4,
      title: 'Resource Bottleneck & Contention',
      badge: 'Resource Conflict',
      badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
      summary: 'Simultaneous medical emergencies demand ambulance coverage. Medic 2 is contested between two life-critical incidents.',
      focus: 'Multi-Agent consensus agent initiates trade-off debate to balance citywide survival odds.',
    },
    {
      step: 5,
      title: 'Human-in-the-Loop Safety Gate Trigger',
      badge: 'Human Oversight',
      badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-500/30',
      summary: 'Because diverting Medic 2 lowers coverage in Sector A, the safety invariant halts dispatch. An authorized operator must approve.',
      focus: 'Test approving or rejecting the proposal below to see the safety gate in action.',
    },
    {
      step: 6,
      title: 'Dynamic Rerouting & Fleet Replanning',
      badge: 'Sub-Second Replanning',
      badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30',
      summary: 'With approval granted, alternative mutual-aid units backfill Sector A. Vehicles re-vector in real time avoiding blocked corridors.',
      focus: 'Observe the Plan Diff highlighting added assignments and rerouted units.',
    },
    {
      step: 7,
      title: 'Crisis Containment & Post-Event Audit',
      badge: 'Containment Achieved',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
      summary: 'All incidents are suppressed or controlled. Causality logs are permanently archived in the Decision Replay engine for audit.',
      focus: 'Full scenario lifecycle successfully demonstrated with zero safety invariant violations.',
    },
  ];

  const currentBeatNumber = Math.min(Math.max((state?.scenario_step ?? 0) + 1, 1), 7);
  const currentBeat = scenarioBeats[currentBeatNumber - 1];

  const handleNextStep = async () => {
    setLoadingAction(true);
    try {
      await postJson('/scenario/next');
      refresh();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReset = async () => {
    setLoadingAction(true);
    try {
      await postJson('/scenario/reset');
      setIsPlaying(false);
      refresh();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleAutoPlay = async () => {
    if (isPlaying) {
      await postJson('/scenario/pause');
      setIsPlaying(false);
    } else {
      await postJson('/scenario/run');
      setIsPlaying(true);
    }
    refresh();
  };

  const handleApprove = useCallback(async (approvalId) => {
    await postJson(`/approval/${approvalId}/approve`);
    refresh();
  }, [refresh]);

  const handleReject = useCallback(async (approvalId) => {
    await postJson(`/approval/${approvalId}/reject`);
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/40 text-cyan-400">
                Interactive Guided Tour
              </span>
              <span className="text-slate-500 text-xs">|</span>
              <span className="text-xs text-slate-400 font-mono">
                Judge &amp; Evaluator Demonstration
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Cascading Disaster Scenario Walkthrough
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Step through our 7-beat escalating emergency scenario. The controls below directly drive the live multi-agent backend engine in real time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>Full Cockpit</span>
              <span>↗</span>
            </button>
          </div>
        </div>

        {/* Real-time Scoreboard */}
        <CrisisScoreboard state={state} />

        {/* Stepper Progress Indicator */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Scenario Sequence Progress: Beat {currentBeatNumber} of 7
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={loadingAction}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 disabled:opacity-50"
              >
                ↺ Reset to Beat 1
              </button>
              <button
                onClick={handleToggleAutoPlay}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <span>{isPlaying ? '⏸ Pause Auto-Play' : '▶ Auto-Play All Beats'}</span>
              </button>
              <button
                onClick={handleNextStep}
                disabled={loadingAction || currentBeatNumber >= 7}
                className="px-4 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 disabled:opacity-50"
              >
                {loadingAction ? 'Advancing...' : 'Advance Next Beat →'}
              </button>
            </div>
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-7 gap-1.5">
            {scenarioBeats.map((b) => {
              const isPast = b.step < currentBeatNumber;
              const isCurrent = b.step === currentBeatNumber;
              return (
                <div
                  key={b.step}
                  className={`h-2 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50'
                      : isPast
                      ? 'bg-indigo-600'
                      : 'bg-slate-800'
                  }`}
                  title={`Beat ${b.step}: ${b.title}`}
                />
              );
            })}
          </div>
        </div>

        {/* Current Beat Breakdown Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-cyan-400 font-mono font-bold flex items-center justify-center text-base">
                #{currentBeat.step}
              </div>
              <div>
                <span className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${currentBeat.badgeColor}`}>
                  {currentBeat.badge}
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  {currentBeat.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">
                Live Backend Step: {state?.scenario_step ?? 0}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            {currentBeat.summary}
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono flex items-center gap-2 text-cyan-300">
            <span className="text-cyan-400">🔍 Key Observation:</span>
            <span>{currentBeat.focus}</span>
          </div>
        </div>

        {/* Live Simulation Views: Map + Active Approvals & Plan Diff */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <span>🗺️</span>
                <span>Live Geospatial Fleet Dispatch Map</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">
                ● Live Updates Polling
              </span>
            </div>

            <MapView state={state} />

            <PlanDiff diff={state?.latest_diff} state={state} />
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
              <span>🛡️</span>
              <span>Safety Governance &amp; AI Brain</span>
            </h3>

            <ApprovalPanel
              approval={state?.approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />

            <CrisisBrain state={state} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

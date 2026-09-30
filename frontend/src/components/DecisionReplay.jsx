import React, { useState, useEffect, useMemo } from 'react';

const EVENT_TYPE_STYLES = {
  incident_created: {
    label: 'incident_created',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: '🚨',
  },
  critical_incident_created: {
    label: 'critical_incident_created',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: '🔥',
  },
  uncertain_incident_detected: {
    label: 'uncertain_incident_detected',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: '❓',
  },
  resource_failed: {
    label: 'resource_failed',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: '💥',
  },
  resource_conflict: {
    label: 'resource_conflict',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: '⚔️',
  },
  allocation_proposed: {
    label: 'allocation_proposed',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: '🧭',
  },
  approval_required: {
    label: 'approval_required',
    badge: 'bg-rose-600/30 text-rose-300 border-rose-500/50 animate-pulse',
    icon: '⚠️',
  },
  approval_granted: {
    label: 'approval_granted',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: '✓',
  },
  dispatch_executed: {
    label: 'dispatch_executed',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: '🚑',
  },
  plan_updated: {
    label: 'plan_updated',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: '📋',
  },
};

/**
 * Builds chronological causality steps grounded in actual recorded state events.
 */
function extractCausalSteps(state) {
  if (!state) return [];

  const eventLog = state.event_log || [];
  const incidents = state.incidents || [];
  const steps = [];

  // Check which scenario steps actually occurred in the event log / state
  const hasStep1 =
    eventLog.some((l) => l.includes('[Scenario Step 1]')) ||
    incidents.some((i) => i.id === 'I1');
  const hasStep2 =
    eventLog.some((l) => l.includes('[Scenario Step 2]')) ||
    incidents.some((i) => i.id === 'I2');
  const hasStep3 =
    eventLog.some((l) => l.includes('[Scenario Step 3]')) ||
    incidents.some((i) => i.id === 'I3');
  const hasStep4 =
    eventLog.some((l) => l.includes('[Scenario Step 4]')) ||
    incidents.some((i) => i.id === 'I4');
  const hasStep5 =
    eventLog.some((l) => l.includes('[Scenario Step 5]')) ||
    eventLog.some((l) => l.includes('Resource A3 status changed to unavailable')) ||
    eventLog.some((l) => l.includes('A3 failed'));
  const hasStep6 =
    eventLog.some((l) => l.includes('[Scenario Step 6]')) ||
    eventLog.some((l) => l.includes('approved by coordinator'));
  const hasStep7 =
    eventLog.some((l) => l.includes('[Scenario Step 7]')) ||
    eventLog.some((l) => l.includes('What-If simulation executed'));

  if (hasStep1) {
    steps.push({
      time: 0,
      eventType: 'incident_created',
      title: 'INCIDENT CREATED / DISPATCH',
      entityInvolved: 'Incident: I1 (MG Road Metro) | Resource: A1 (Ambulance)',
      explanation:
        'Motorcycle accident with pedestrian injury reported near MG Road Metro. Allocation agent assigns nearest available ambulance A1 (ETA 3.0m).',
      planVersion: 'v1',
      stateChange:
        'Incident I1 registered (Severity 3/5, Medical); Ambulance A1 dispatched; Plan v1 committed.',
    });
  }

  if (hasStep2) {
    steps.push({
      time: 5,
      eventType: 'critical_incident_created',
      title: 'CRITICAL INCIDENT SURGE',
      entityInvolved: 'Incident: I2 (Shivajinagar Depot) | Resources: F1, F2, A2',
      explanation:
        'Commercial warehouse electrical fire with smoke inhalation casualties reported at Shivajinagar. Dispatches Fire Engines F1 and F2, and Ambulance A2.',
      planVersion: 'v2',
      stateChange:
        'Incident I2 registered (Severity 4/5, Fire); Units F1, F2, A2 deployed; Plan v2 committed.',
    });
  }

  if (hasStep3) {
    steps.push({
      time: 10,
      eventType: 'uncertain_incident_detected',
      title: 'UNCERTAIN INCIDENT DETECTED',
      entityInvolved: 'Incident: I3 (Richmond Circle Flyover)',
      explanation:
        'Free-text citizen report of collapsed civilian near flyover. Location and critical attributes are unverified. AI assessment flags uncertain_fields; safety policy inhibits automated dispatch until confirmed by human coordinator.',
      planVersion: 'v3',
      stateChange:
        'Incident I3 recorded with needs_confirmation=True; Resource dispatch held in reserve (0 units sent).',
    });
  }

  if (hasStep4) {
    steps.push({
      time: 15,
      eventType: 'critical_incident_created',
      title: 'CATASTROPHIC BUILDING COLLAPSE',
      entityInvolved: 'Incident: I4 (Town Hall) | Resources: R1, F1, A1, A3',
      explanation:
        'Multi-story commercial building collapse with 20 casualties trapped. Severity 5 demands immediate rescue team, fire apparatus, and ambulances. Multi-agency preemption triggers reallocation of A1 from I1 to I4.',
      planVersion: 'v4',
      stateChange:
        'Incident I4 recorded (Severity 5/5, Rescue); A1 preempted from lower-priority I1 to I4; Plan v4 committed.',
    });
  }

  if (hasStep5) {
    steps.push({
      time: 20,
      eventType: 'resource_conflict',
      title: 'RESOURCE FAILURE / CONFLICT',
      entityInvolved:
        'A3 failed.\n\nA2 identified as an alternative for I4,\nbut A2 is already assigned to I2.\n\nHuman approval required.',
      explanation:
        'Ambulance A3 suffered mechanical failure while en route to I4. Reallocation engine evaluated preemption of Ambulance A2 from Incident I2 (Severity 4). Because this reallocates resources away from an active high-severity incident, policy triggers mandatory human coordinator approval.',
      planVersion: 'v4',
      stateChange:
        'A3 status changed to unavailable; Proposed Plan v5 generated; Approval request appr_20_5 pending.',
    });
  }

  if (hasStep6) {
    steps.push({
      time: 22,
      eventType: 'approval_granted',
      title: 'APPROVED REALLOCATION',
      entityInvolved: 'Operator approved:\n\nA2 → I4',
      explanation:
        'Human coordinator reviewed preemption trade-offs and approved reallocation of Ambulance A2 to Catastrophic Collapse incident I4. Proposed plan promoted and constraints locked.',
      planVersion: 'v5',
      stateChange:
        'Approval appr_20_5 approved; Proposed plan promoted to Plan v5; A2 rerouted to I4 with approved lock.',
    });
  }

  if (hasStep7) {
    steps.push({
      time: 22,
      eventType: 'plan_updated',
      title: 'WHAT-IF VERIFICATION & CONTAINMENT',
      entityInvolved: 'Simulation Snapshot & Active Fleet',
      explanation:
        'What-If simulation executed on snapshot without mutating live CrisisState. Approved units active on scene; containment operations underway with complete audit trail.',
      planVersion: 'v6',
      stateChange:
        'Live state unchanged; Counterfactual resiliency verified; Full audit checksum recorded.',
    });
  }

  // Fallback for clean initial state
  if (steps.length === 0) {
    steps.push({
      time: state.clock_min || 0,
      eventType: 'plan_updated',
      title: 'SYSTEM INITIALIZATION',
      entityInvolved: 'System Fleet (6 Units Ready)',
      explanation:
        'Simulation reset to initial seed state. Fleet available at base stations. Awaiting emergency triggers.',
      planVersion: 'v0',
      stateChange: 'System ready; 0 active incidents; clock t=0m.',
    });
  }

  // Label Step X of N
  const totalSteps = steps.length;
  return steps.map((s, idx) => ({
    ...s,
    step: idx + 1,
    totalSteps,
  }));
}

/**
 * DecisionReplay: Step-by-Step Visual Causality Chain Player
 * Replays autonomous planning actions and human-in-the-loop decisions across chronological ticks.
 * Strictly READ-ONLY: Controls only manipulate internal UI state and NEVER mutate backend/live state.
 */
export default function DecisionReplay({ state }) {
  const steps = useMemo(() => extractCausalSteps(state), [state]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep index within bounds if total steps changes
  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(Math.max(0, steps.length - 1));
    }
  }, [steps.length, currentStepIndex]);

  // Autoplay playback loop - purely local UI state advancement
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStep = steps[currentStepIndex] || steps[0] || {};
  const eventStyle = EVENT_TYPE_STYLES[activeStep.eventType] || EVENT_TYPE_STYLES.plan_updated;

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const handlePlayToggle = () => {
    if (!isPlaying && currentStepIndex >= steps.length - 1) {
      // Loop from beginning if at the end
      setCurrentStepIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepClick = (idx) => {
    setIsPlaying(false);
    setCurrentStepIndex(idx);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎞️</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              Decision Replay &bull; Causality Chain Player
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive step-by-step causality timeline &bull; Read-only historical audit
            </p>
          </div>
        </div>

        {/* Step X of N Indicator */}
        <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-500/40">
          Step {activeStep.step} of {activeStep.totalSteps}
        </span>
      </div>

      {/* Playback Controls & Progress Scrubber */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 transition-colors shadow-sm"
            title="Previous step (UI only)"
          >
            ⏮ Prev
          </button>

          <button
            onClick={handlePlayToggle}
            className={`${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            } text-white font-semibold px-3.5 py-1 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5`}
            title={isPlaying ? 'Pause replay' : 'Play replay forward'}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentStepIndex >= steps.length - 1}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 transition-colors shadow-sm"
            title="Next step (UI only)"
          >
            Next ⏭
          </button>
        </div>

        {/* Scrubber step buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {steps.map((st, idx) => (
            <button
              key={idx}
              onClick={() => handleStepClick(idx)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                idx === currentStepIndex
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50 shadow-md scale-105'
                  : idx < currentStepIndex
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300'
              }`}
              title={`Jump to Step ${st.step}: ${st.title} (t=${st.time}m)`}
            >
              Step {st.step}
            </button>
          ))}
        </div>
      </div>

      {/* Causality Stage Card */}
      <div className="p-3 text-xs space-y-3">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
          {/* Top Metadata Row: Step X of N | Time | Event Type | Plan Version */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Step {activeStep.step} of {activeStep.totalSteps}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-500/30">
                t={activeStep.time}m
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border tracking-wider uppercase ${eventStyle.badge}`}
              >
                <span>{eventStyle.icon}</span>
                <span>{activeStep.eventType}</span>
              </span>
            </div>

            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 px-2.5 py-0.5 rounded border border-sky-800/60">
              Plan Version: {activeStep.planVersion}
            </span>
          </div>

          {/* Title Header */}
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-1.5">
              <span>⚡</span> {activeStep.title}
            </h3>
          </div>

          {/* Incident / Resource Involved */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-lg p-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              📍 Incident / Resource Involved:
            </span>
            <div className="text-xs font-mono font-medium text-slate-200 whitespace-pre-line leading-relaxed">
              {activeStep.entityInvolved}
            </div>
          </div>

          {/* Explanation / Rationale */}
          <div className="bg-slate-900/60 border border-slate-800/70 rounded-lg p-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              🧠 Explanation / Causality Rationale:
            </span>
            <p className="text-slate-300 text-xs leading-relaxed font-sans">
              {activeStep.explanation}
            </p>
          </div>

          {/* Relevant State Change */}
          <div className="bg-slate-900/60 border border-slate-800/70 rounded-lg p-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              🔄 Relevant State Change:
            </span>
            <p className="text-amber-300/90 text-xs font-mono leading-relaxed">
              {activeStep.stateChange}
            </p>
          </div>
        </div>

        {/* Read-Only Safety Banner */}
        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span>🛡️</span>
            <span>READ-ONLY CAUSALITY PLAYER &bull; ZERO LIVE STATE MUTATION</span>
          </span>
          <span className="text-emerald-400 font-bold">STATE FROZEN ✓</span>
        </div>
      </div>
    </div>
  );
}

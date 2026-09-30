import React, { useState, useEffect } from 'react';

/**
 * DecisionReplay: Step-by-Step Visual Causality Chain Player
 * Replays autonomous planning actions and human-in-the-loop decisions across chronological ticks.
 */
export default function DecisionReplay({ state }) {
  const eventLog = state?.event_log || [];
  const planHistory = state?.plan_history || [];

  // Build unified causality steps from history & event log
  const steps = React.useMemo(() => {
    if (planHistory.length > 0) {
      return planHistory.map((entry, idx) => ({
        step: idx + 1,
        time: entry.created_at_min ?? idx * 2,
        trigger: entry.trigger_kind || 'Dispatch Event',
        planId: entry.plan_id || `plan_${idx}`,
        version: entry.version || idx + 1,
        reasoning: entry.reasoning || entry.explanation || `Autonomous reallocation plan version ${entry.version || idx + 1}`,
        assignmentsCount: entry.assignments?.length || 0,
        unmetCount: entry.unmet?.length || 0,
        approvalRequired: entry.requires_approval || false,
      }));
    }

    // Fallback using eventLog
    if (eventLog.length > 0) {
      return eventLog.map((logMsg, idx) => ({
        step: idx + 1,
        time: idx * 2,
        trigger: 'System Trigger',
        planId: `step_${idx + 1}`,
        version: idx + 1,
        reasoning: logMsg,
        assignmentsCount: state?.current_plan?.assignments?.length || 0,
        unmetCount: 0,
        approvalRequired: false,
      }));
    }

    return [
      {
        step: 1,
        time: 0,
        trigger: 'System Initialization',
        planId: 'baseline_plan',
        version: 1,
        reasoning: 'Initial baseline dispatch state initialized.',
        assignmentsCount: 1,
        unmetCount: 0,
        approvalRequired: false,
      },
    ];
  }, [planHistory, eventLog, state?.current_plan]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep index within bounds if steps change
  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(Math.max(0, steps.length - 1));
    }
  }, [steps.length, currentStepIndex]);

  // Autoplay playback loop
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
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStep = steps[currentStepIndex] || steps[0];

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
              Interactive timeline of autonomous trigger &rarr; rationale &rarr; dispatch resolution
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <span className="font-mono text-xs text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          Step {activeStep?.step} of {steps.length}
        </span>
      </div>

      {/* Playback Controls & Progress Bar */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentStepIndex === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-2 py-1 rounded text-xs border border-slate-700 transition-colors"
          >
            ⏮ Prev
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
            } text-white font-medium px-3 py-1 rounded text-xs shadow transition-colors flex items-center gap-1`}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
            }}
            disabled={currentStepIndex >= steps.length - 1}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-2 py-1 rounded text-xs border border-slate-700 transition-colors"
          >
            Next ⏭
          </button>
        </div>

        {/* Scrubber dots */}
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {steps.map((st, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIndex(idx);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx === currentStepIndex
                  ? 'bg-indigo-400 ring-2 ring-indigo-400/40 scale-125'
                  : idx < currentStepIndex
                  ? 'bg-slate-600'
                  : 'bg-slate-800'
              }`}
              title={`Step ${st.step}: ${st.trigger}`}
            />
          ))}
        </div>
      </div>

      {/* Causality Stage Card */}
      <div className="p-3 text-xs space-y-2.5">
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
          {/* Top metadata */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                t={activeStep.time}m
              </span>
              <span className="font-semibold text-slate-200 text-xs">
                Trigger: <strong className="text-amber-300">{activeStep.trigger}</strong>
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              Plan Version: <strong>v{activeStep.version}</strong>
            </span>
          </div>

          {/* Reasoning / Causality Chain */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Autonomous Agent Rationale:
            </span>
            <p className="text-slate-200 text-xs leading-relaxed font-sans bg-slate-900/60 p-2 rounded border border-slate-800/80">
              {activeStep.reasoning}
            </p>
          </div>

          {/* Outcome metrics at this step */}
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-300">
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Assignments</span>
              <span className="font-bold text-sky-400">{activeStep.assignmentsCount} Units</span>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Unmet Slots</span>
              <span className="font-bold text-rose-400">{activeStep.unmetCount}</span>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Human Gate</span>
              <span className={`font-bold ${activeStep.approvalRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                {activeStep.approvalRequired ? 'Required ⚠️' : 'Autonomous ✓'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

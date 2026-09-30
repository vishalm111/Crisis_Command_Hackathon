import React, { useState, useEffect } from 'react';
import { postJson } from '../api';

const STORY_STEPS = [
  {
    step: 1,
    title: '1. Baseline Dispatch',
    narration: 'Incident I1 (Cardiac Emergency) reported at Downtown. Autonomous agent dispatches primary Ambulance A1.',
    action: async (post) => {
      await post('/scenario/reset', {});
    },
  },
  {
    step: 2,
    title: '2. Cascading Outbreak',
    narration: 'Incident I2 (Chemical Hazmat Spill) erupts at Industrial Park. Fire engines F1 and F2 are deployed.',
    action: async (post) => {
      await post('/scenario/next', {});
    },
  },
  {
    step: 3,
    title: '3. Critical Asset Failure',
    narration: 'Primary unit A1 suffers severe engine breakdown en route! Crisis escalation triggers.',
    action: async (post) => {
      await post('/resources/A1/fail', {});
    },
  },
  {
    step: 4,
    title: '4. Autonomous Replanning',
    narration: 'Agent detects severed coverage and generates Reallocation Plan v2: Reassigns Ambulance A2.',
    action: async (post) => {
      await post('/scenario/next', {});
    },
  },
  {
    step: 5,
    title: '5. Human-in-the-Loop Gate',
    narration: 'High-severity reallocation requires Human Approval. Safety policy prevents autonomous override.',
    action: async (post, state) => {
      if (state?.approval?.id) {
        await post(`/approval/${state.approval.id}/approve`, {});
      } else {
        await post('/scenario/next', {});
      }
    },
  },
  {
    step: 6,
    title: '6. Arrival & Containment',
    narration: 'Time advances. Approved units arrive on-scene. Hazmat containment and cardiac care proceed.',
    action: async (post) => {
      await post('/time/advance', { minutes: 5 });
    },
  },
  {
    step: 7,
    title: '7. Final Scoreboard & Resolution',
    narration: 'Incidents stabilized. Full decision trace, plan diff, and audit log recorded for governance.',
    action: async (post) => {
      await post('/scenario/next', {});
    },
  },
];

/**
 * SimulationControls:
 * Includes standard sandbox controls + Feature 11: Demo Story Controller
 */
export default function SimulationControls({ state, onAction }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resourceId, setResourceId] = useState('A1');

  // Story Mode State
  const [storyActive, setStoryActive] = useState(false);
  const [storyStep, setStoryStep] = useState(0);

  const resources = state?.resources || [
    { id: 'A1' }, { id: 'A2' }, { id: 'A3' },
    { id: 'F1' }, { id: 'F2' }, { id: 'R1' },
  ];

  const handleAction = async (action, endpoint, payload = {}) => {
    setLoading(true);
    setError(null);
    try {
      await postJson(endpoint, payload);
      if (onAction) {
        onAction();
      }
    } catch (err) {
      setError(`${action} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteStoryStep = async (stepIdx) => {
    if (stepIdx < 0 || stepIdx >= STORY_STEPS.length) return;
    setLoading(true);
    setError(null);
    try {
      const stepObj = STORY_STEPS[stepIdx];
      await stepObj.action(postJson, state);
      setStoryStep(stepIdx);
      if (onAction) {
        onAction();
      }
    } catch (err) {
      setError(`Demo step ${stepIdx + 1} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDemo = async () => {
    setStoryActive(true);
    await handleExecuteStoryStep(0);
  };

  const handleNextDemoStep = async () => {
    const nextIdx = storyStep + 1;
    if (nextIdx < STORY_STEPS.length) {
      await handleExecuteStoryStep(nextIdx);
    }
  };

  const handleResetDemo = async () => {
    setStoryActive(false);
    setStoryStep(0);
    await handleAction('Reset', '/scenario/reset');
  };

  const currentStepObj = STORY_STEPS[storyStep];

  return (
    <div className="bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-xl flex flex-col gap-2.5 text-slate-100">
      {/* Top Bar: Standard Sandbox Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
            <span>⚡</span> Controls:
          </span>

          <button
            disabled={loading}
            onClick={() => handleAction('Reset', '/scenario/reset')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-2.5 py-1 rounded-lg text-xs border border-slate-700 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction('Next Step', '/scenario/next')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            Next Step
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction('Run Scenario', '/scenario/run')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1 rounded-lg text-xs shadow-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <span>▶</span>
            <span>RUN SCENARIO</span>
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction('Advance Time', '/time/advance', { minutes: 5 })}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            +5 min
          </button>

          {/* Unit Failure / Restore Injection */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5 ml-1">
            <span className="text-xs text-slate-400 font-medium">Unit:</span>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              disabled={loading}
              className="bg-slate-800 border border-slate-700 text-white font-mono font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id}
                </option>
              ))}
              {resources.length === 0 && <option value="A1">A1</option>}
            </select>
            <button
              disabled={loading || !resourceId}
              onClick={() => handleAction('Fail Resource', `/resources/${resourceId}/fail`)}
              className="bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-medium px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50"
            >
              Fail
            </button>
            <button
              disabled={loading || !resourceId}
              onClick={() => handleAction('Restore Resource', `/resources/${resourceId}/restore`)}
              className="bg-teal-600/30 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-500/40 font-medium px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50"
            >
              Restore
            </button>
          </div>
        </div>

        {/* Feature 11: Demo Story Mode Activator */}
        <div className="flex items-center gap-2">
          {!storyActive ? (
            <button
              onClick={handleStartDemo}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-3 py-1 rounded-lg text-xs shadow-md flex items-center gap-1.5 transition-all"
            >
              <span>🎬</span>
              <span>Start 7-Step Demo Story</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNextDemoStep}
                disabled={loading || storyStep >= STORY_STEPS.length - 1}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg text-xs shadow transition-all flex items-center gap-1"
              >
                <span>Step {storyStep + 2} &rarr;</span>
              </button>
              <button
                onClick={handleResetDemo}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-xs border border-slate-700 transition-all"
              >
                Exit Demo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feature 11 Narration Banner (When Demo Story Active) */}
      {storyActive && (
        <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/40 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>🎬</span> Demo Story &bull; Step {storyStep + 1} of {STORY_STEPS.length}: {currentStepObj.title}
            </span>
            <div className="flex items-center gap-1">
              {STORY_STEPS.map((s, idx) => (
                <button
                  key={s.step}
                  onClick={() => handleExecuteStoryStep(idx)}
                  className={`w-4 h-4 rounded text-[9px] font-bold transition-all ${
                    idx === storyStep
                      ? 'bg-indigo-500 text-white ring-1 ring-white'
                      : idx < storyStep
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {s.step}
                </button>
              ))}
            </div>
          </div>
          <p className="text-slate-200 text-[11px] leading-relaxed font-sans bg-slate-900/60 p-2 rounded border border-slate-800">
            {currentStepObj.narration}
          </p>
        </div>
      )}

      {error && (
        <div className="text-rose-400 text-xs font-medium bg-rose-950/60 border border-rose-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

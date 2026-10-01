import React, { useState, useCallback } from 'react';
import { getState, postJson } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useRouter } from '../router/Router';

import Header from '../components/Header';
import SafetyBanner from '../components/SafetyBanner';
import SimulationControls from '../components/SimulationControls';
import CrisisScoreboard from '../components/CrisisScoreboard';
import IncidentCards from '../components/IncidentCards';
import AlertsPanel from '../components/AlertsPanel';
import MapView from '../components/MapView';
import PlanPanel from '../components/PlanPanel';
import PlanDiff from '../components/PlanDiff';
import ApprovalPanel from '../components/ApprovalPanel';
import ResourceTable from '../components/ResourceTable';
import ExplanationLog from '../components/ExplanationLog';
import AgentChat from '../components/AgentChat';
import WhatIfPanel from '../components/WhatIfPanel';

// Enhanced Hackathon Feature Components
import CrisisBrain from '../components/CrisisBrain';
import ChaosMode from '../components/ChaosMode';
import ImpactPredictor from '../components/ImpactPredictor';
import DependencyGraph from '../components/DependencyGraph';
import CounterfactualLab from '../components/CounterfactualLab';
import DecisionReplay from '../components/DecisionReplay';
import SystemHealth from '../components/SystemHealth';

export default function CommandCenter() {
  const { navigate } = useRouter();
  const { data: state, error, refresh } = usePolling(getState, 1200);
  const [isJudgeMode, setIsJudgeMode] = useState(false);
  const [centerTab, setCenterTab] = useState('map'); // 'map' | 'topology' | 'replay'
  const [sideTab, setSideTab] = useState('ops'); // 'ops' | 'ai' | 'lab'

  const handleApprove = useCallback(async (approvalId) => {
    await postJson(`/approval/${approvalId}/approve`);
    refresh();
  }, [refresh]);

  const handleReject = useCallback(async (approvalId) => {
    await postJson(`/approval/${approvalId}/reject`);
    refresh();
  }, [refresh]);

  const handleEscalate = useCallback(async (incidentId, nextSeverity) => {
    await postJson(`/incidents/${incidentId}/escalate`, { severity: nextSeverity });
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 selection:bg-indigo-500/30">
      <SafetyBanner />
      
      {/* Portal Quick Navigation Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors font-medium group"
            title="Return to Public Website"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>Crisis Command Portal</span>
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300 font-mono text-[11px] tracking-wider uppercase font-semibold">
              Live Operations Cockpit
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/demo')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-500/20"
          >
            <span>▶</span> Interactive Walkthrough
          </button>
          <button
            onClick={() => navigate('/docs')}
            className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline px-2 py-0.5"
          >
            API &amp; Architecture
          </button>
        </div>
      </div>

      <Header
        state={state}
        isJudgeMode={isJudgeMode}
        onToggleJudgeMode={() => setIsJudgeMode(!isJudgeMode)}
      />

      {error && (
        <div className="bg-amber-900/40 border-b border-amber-500/40 px-4 py-2 text-center text-xs text-amber-200 font-medium flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>Backend connection lost: {error.message}. Polling active...</span>
        </div>
      )}

      {/* JUDGE / PRESENTATION MODE VIEW */}
      {isJudgeMode ? (
        <main className="flex-1 p-3.5 flex flex-col gap-3 max-w-7xl mx-auto w-full">
          <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <div>
                <strong className="text-purple-300 uppercase tracking-wide">
                  Executive Judge &amp; Storytelling Mode
                </strong>
                <p className="text-slate-300 text-[11px]">
                  Curated layout highlighting autonomous multi-agent decision chains, human governance, and safety immutability.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsJudgeMode(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg border border-slate-700 font-medium"
            >
              Exit to Standard Dashboard
            </button>
          </div>

          <SimulationControls state={state} onAction={refresh} />
          <CrisisScoreboard state={state} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CrisisBrain state={state} />
            <ApprovalPanel
              approval={state?.approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <MapView state={state} />
            </div>
            <div>
              <PlanPanel
                plan={state?.current_plan}
                incidents={state?.incidents}
                resources={state?.resources}
                state={state}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DecisionReplay state={state} />
            <CounterfactualLab state={state} />
          </div>
        </main>
      ) : (
        /* STANDARD DASHBOARD LAYOUT */
        <main className="flex-1 p-3 grid grid-cols-12 gap-2.5">
          {/* Top Row: Scoreboard + Simulation & Story Controls */}
          <div className="col-span-12 flex flex-col gap-2.5">
            <CrisisScoreboard state={state} />
            <SimulationControls state={state} onAction={refresh} />
          </div>

          {/* Left Column (col-span-12 lg:col-span-3): Incidents, Alerts, Chaos Engineering */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5">
            <IncidentCards
              incidents={state?.incidents}
              onEscalate={handleEscalate}
            />
            <AlertsPanel alerts={state?.alerts} />
            <ChaosMode onAction={refresh} />
          </div>

          {/* Center Column (col-span-12 lg:col-span-6): Map, Topology, Replay, Active Plan & Diff */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-2.5">
            {/* Center Tab Selector */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs self-start">
              <button
                onClick={() => setCenterTab('map')}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  centerTab === 'map'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🗺️</span>
                <span>Geospatial Map</span>
              </button>
              <button
                onClick={() => setCenterTab('topology')}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  centerTab === 'topology'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🕸️</span>
                <span>Dependency Graph</span>
              </button>
              <button
                onClick={() => setCenterTab('replay')}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  centerTab === 'replay'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎞️</span>
                <span>Decision Replay</span>
              </button>
            </div>

            {centerTab === 'map' && <MapView state={state} />}
            {centerTab === 'topology' && <DependencyGraph state={state} />}
            {centerTab === 'replay' && <DecisionReplay state={state} />}

            <PlanPanel
              plan={state?.current_plan}
              incidents={state?.incidents}
              resources={state?.resources}
              state={state}
            />

            <PlanDiff
              diff={state?.latest_diff}
              state={state}
            />
          </div>

          {/* Right Column (col-span-12 lg:col-span-3): Approvals, Crisis Brain, Lab, Chat, Telemetry */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5">
            <ApprovalPanel
              approval={state?.approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />

            {/* Right Sub-View Tabs */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setSideTab('ops')}
                className={`flex-1 py-1 rounded-lg font-medium transition-all text-center ${
                  sideTab === 'ops'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fleet &amp; Health
              </button>
              <button
                onClick={() => setSideTab('ai')}
                className={`flex-1 py-1 rounded-lg font-medium transition-all text-center ${
                  sideTab === 'ai'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AI Brain
              </button>
              <button
                onClick={() => setSideTab('lab')}
                className={`flex-1 py-1 rounded-lg font-medium transition-all text-center ${
                  sideTab === 'lab'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lab &amp; Risk
              </button>
            </div>

            {sideTab === 'ops' && (
              <>
                <ResourceTable state={state} onAction={refresh} />
                <AgentChat messages={state?.messages} />
                <SystemHealth state={state} error={error} />
              </>
            )}

            {sideTab === 'ai' && (
              <>
                <CrisisBrain state={state} />
                <ExplanationLog
                  explanations={state?.explanations}
                  traces={state?.traces}
                  llmStatus={state?.llm_status}
                />
                <AgentChat messages={state?.messages} />
              </>
            )}

            {sideTab === 'lab' && (
              <>
                <ImpactPredictor state={state} />
                <CounterfactualLab state={state} />
                <WhatIfPanel state={state} />
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

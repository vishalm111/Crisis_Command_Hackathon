import React, { useCallback } from 'react';
import { getState, postJson } from './api';
import { usePolling } from './hooks/usePolling';

import Header from './components/Header';
import SafetyBanner from './components/SafetyBanner';
import SimulationControls from './components/SimulationControls';
import IncidentCards from './components/IncidentCards';
import AlertsPanel from './components/AlertsPanel';
import MapView from './components/MapView';
import PlanPanel from './components/PlanPanel';
import PlanDiff from './components/PlanDiff';
import ApprovalPanel from './components/ApprovalPanel';
import ResourceTable from './components/ResourceTable';
import ExplanationLog from './components/ExplanationLog';
import AgentChat from './components/AgentChat';
import WhatIfPanel from './components/WhatIfPanel';

function App() {
  const { data: state, error, refresh } = usePolling(getState, 1200);

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
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
      <SafetyBanner />
      <Header />

      {error && (
        <div className="bg-amber-900/40 border-b border-amber-500/40 px-4 py-2 text-center text-xs text-amber-200 font-medium flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>Backend connection lost: {error.message}. Polling active...</span>
        </div>
      )}

      <main className="flex-1 p-3 grid grid-cols-12 gap-2.5">
        {/* Top: Simulation & Demonstration Controls */}
        <div className="col-span-12">
          <SimulationControls state={state} onAction={refresh} />
        </div>

        {/* Left Column: Incidents & System Alerts */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5">
          <IncidentCards
            incidents={state?.incidents}
            onEscalate={handleEscalate}
          />
          <AlertsPanel alerts={state?.alerts} />
        </div>

        {/* Center Column: Geospatial Map, Active Plan & Plan Diff */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-2.5">
          <MapView state={state} />
          <PlanPanel
            plan={state?.current_plan}
            incidents={state?.incidents}
            resources={state?.resources}
          />
          <PlanDiff
            diff={state?.latest_diff}
            state={state}
          />
        </div>

        {/* Right Column: Approval Gate, Resources, Decision Traces, Agent Comms & What-If Sandbox */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2.5">
          <ApprovalPanel
            approval={state?.approval}
            onApprove={handleApprove}
            onReject={handleReject}
          />
          <ResourceTable state={state} />
          <ExplanationLog
            explanations={state?.explanations}
            traces={state?.traces}
            llmStatus={state?.llm_status}
          />
          <AgentChat messages={state?.messages} />
          <WhatIfPanel state={state} />
        </div>
      </main>
    </div>
  );
}

export default App;

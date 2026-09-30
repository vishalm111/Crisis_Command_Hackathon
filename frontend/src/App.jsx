import React from 'react';
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
import { usePolling } from './hooks/usePolling';
import { getState, postJson } from './api';

function App() {
    const { data: state, error } = usePolling(getState, 2000);

    const handleEscalate = async (incidentId, severity) => {
        await postJson(`/incidents/${incidentId}/escalate`, { severity });
    };

    const handleFail = async (resourceId) => {
        await postJson(`/resources/${resourceId}/fail`, {});
    };

    const handleRestore = async (resourceId) => {
        await postJson(`/resources/${resourceId}/restore`, {});
    };

    const handleApprove = async (approvalId) => {
        await postJson(`/approval/${approvalId}/approve`, {});
    };

    const handleReject = async (approvalId) => {
        await postJson(`/approval/${approvalId}/reject`, {});
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <SafetyBanner />
            <Header />
            {error && (
                <div className="bg-red-100 text-red-700 p-2 text-center text-sm">
                    Backend connection error: {error.message}
                </div>
            )}
            <div className="flex-1 p-4 grid grid-cols-12 gap-4">
                <div className="col-span-12">
                   <SimulationControls state={state} />
                </div>
                <div className="col-span-3 flex flex-col gap-4">
                    <IncidentCards incidents={state?.incidents} onEscalate={handleEscalate} />
                    <AlertsPanel alerts={state?.alerts} />
                </div>
                <div className="col-span-6 flex flex-col gap-4">
                    <MapView state={state} />
                    <PlanPanel plan={state?.current_plan} />
                    <PlanDiff 
                        diff={state?.approval?.diff} 
                        metricsBefore={state?.current_plan?.metrics}
                        metricsAfter={state?.approval?.proposed_plan?.metrics} 
                    />
                </div>
                <div className="col-span-3 flex flex-col gap-4">
                    <ApprovalPanel 
                        approval={state?.approval} 
                        onApprove={handleApprove}
                        onReject={handleReject}
                    />
                    <ResourceTable 
                        resources={state?.resources} 
                        currentPlan={state?.current_plan} 
                        onFail={handleFail}
                        onRestore={handleRestore}
                    />
                    <ExplanationLog explanations={state?.explanations} />
                    <AgentChat messages={state?.messages} />
                    <WhatIfPanel resources={state?.resources} incidents={state?.incidents} />
                </div>
            </div>
        </div>
    );
}

export default App;

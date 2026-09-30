import { lazy, Suspense } from 'react';
import Header from './components/Header';
import SafetyBanner from './components/SafetyBanner';

const withPlaceholder = (name) => {
    return lazy(() => import(/* @vite-ignore */ `./components/${name}.jsx`).catch(() => ({
        default: () => <div className="border border-dashed border-gray-400 p-4 text-gray-500 text-center rounded">{name} (Not implemented)</div>
    })));
};

const PlanPanel = withPlaceholder('PlanPanel');
const ApprovalPanel = withPlaceholder('ApprovalPanel');
const IncidentCards = withPlaceholder('IncidentCards');
const AlertsPanel = withPlaceholder('AlertsPanel');
const ExplanationLog = withPlaceholder('ExplanationLog');
const AgentChat = withPlaceholder('AgentChat');
const ResourceTable = withPlaceholder('ResourceTable');
const PlanDiff = withPlaceholder('PlanDiff');
const WhatIfPanel = withPlaceholder('WhatIfPanel');
const MapView = withPlaceholder('MapView');
const SimulationControls = withPlaceholder('SimulationControls');

function App() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <SafetyBanner />
            <Header />
            <div className="flex-1 p-4 grid grid-cols-12 gap-4">
                <div className="col-span-12">
                   <Suspense fallback={<div>Loading controls...</div>}><SimulationControls /></Suspense>
                </div>
                <div className="col-span-3 flex flex-col gap-4">
                    <Suspense fallback={<div>Loading...</div>}><IncidentCards /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><AlertsPanel /></Suspense>
                </div>
                <div className="col-span-6 flex flex-col gap-4">
                    <Suspense fallback={<div>Loading...</div>}><MapView /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><PlanPanel /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><PlanDiff /></Suspense>
                </div>
                <div className="col-span-3 flex flex-col gap-4">
                    <Suspense fallback={<div>Loading...</div>}><ApprovalPanel /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><ResourceTable /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><ExplanationLog /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><AgentChat /></Suspense>
                    <Suspense fallback={<div>Loading...</div>}><WhatIfPanel /></Suspense>
                </div>
            </div>
        </div>
    );
}

export default App;

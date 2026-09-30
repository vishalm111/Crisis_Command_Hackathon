import { useState } from 'react';
import { postJson } from '../api';

export default function SimulationControls({ state }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resourceId, setResourceId] = useState('A1');

    const resources = state?.resources || [
        {id: "A1"}, {id: "A2"}, {id: "A3"},
        {id: "F1"}, {id: "F2"}, {id: "R1"}
    ];

    const handleAction = async (action, endpoint, payload = {}) => {
        setLoading(true);
        setError(null);
        try {
            await postJson(endpoint, payload);
        } catch (err) {
            setError(`${action} failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-gray-800 uppercase tracking-wide text-sm mr-2">Controls</h2>
            
            <button 
                disabled={loading} 
                onClick={() => handleAction('Reset', '/scenario/reset')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"
            >
                Reset
            </button>
            <button 
                disabled={loading} 
                onClick={() => handleAction('Next Step', '/scenario/next')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
            >
                Next Step
            </button>
            <button 
                disabled={loading} 
                onClick={() => handleAction('Run Scenario', '/scenario/run')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
            >
                RUN HACKATHON SCENARIO
            </button>
            <button 
                disabled={loading} 
                onClick={() => handleAction('Advance Time', '/time/advance', { minutes: 5 })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
            >
                Advance 5 min
            </button>

            <div className="flex items-center gap-2 border-l-2 border-gray-100 pl-3 ml-2">
                <select 
                    value={resourceId} 
                    onChange={e => setResourceId(e.target.value)}
                    disabled={loading}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {resources.map(r => (
                        <option key={r.id} value={r.id}>{r.id}</option>
                    ))}
                    {resources.length === 0 && <option value="A1">A1</option>}
                </select>
                <button 
                    disabled={loading || !resourceId}
                    onClick={() => handleAction('Fail Resource', `/resources/${resourceId}/fail`)}
                    className="bg-red-500 hover:bg-red-600 text-white font-medium px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                    Fail
                </button>
                <button 
                    disabled={loading || !resourceId}
                    onClick={() => handleAction('Restore Resource', `/resources/${resourceId}/restore`)}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                    Restore
                </button>
            </div>

            {error && <div className="text-red-600 text-sm font-medium ml-auto bg-red-50 px-3 py-1 rounded-md">{error}</div>}
        </div>
    );
}

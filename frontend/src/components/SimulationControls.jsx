import { useState } from 'react';
import { postJson } from '../api';

export default function SimulationControls({ state, onAction }) {
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
            if (onAction) {
                onAction();
            }
        } catch (err) {
            setError(`${action} failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between gap-3 flex-wrap text-slate-100">
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

                <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5 ml-1">
                    <span className="text-xs text-slate-400 font-medium">Unit:</span>
                    <select 
                        value={resourceId} 
                        onChange={e => setResourceId(e.target.value)}
                        disabled={loading}
                        className="bg-slate-800 border border-slate-700 text-white font-mono font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        {resources.map(r => (
                            <option key={r.id} value={r.id}>{r.id}</option>
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

            {error && (
                <div className="text-rose-400 text-xs font-medium bg-rose-950/60 border border-rose-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

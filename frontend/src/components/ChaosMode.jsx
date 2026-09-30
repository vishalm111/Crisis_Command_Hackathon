import React, { useState } from 'react';
import { postJson } from '../api';

/**
 * ChaosMode: Controlled Stress-Testing Simulation
 * Tests system resilience, fallback logic, and autonomous recovery under random adverse events.
 */
export default function ChaosMode({ onAction }) {
  const [intensity, setIntensity] = useState('medium');
  const [allowedEvents, setAllowedEvents] = useState({
    failure: true,
    incident: true,
    escalation: true,
    restore: true,
  });
  const [loading, setLoading] = useState(false);
  const [lastChaosEvent, setLastChaosEvent] = useState(null);
  const [error, setError] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);

  const toggleEvent = (key) => {
    setAllowedEvents((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTriggerChaos = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeTypes = Object.entries(allowedEvents)
        .filter(([, v]) => v)
        .map(([k]) => k);

      if (activeTypes.length === 0) {
        throw new Error('Please select at least one chaos event type.');
      }

      const result = await postJson('/chaos/step', {
        intensity,
        allowed_events: activeTypes,
      });

      setLastChaosEvent(result);
      setEventHistory((prev) => [
        { ...result, timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(0, 4),
      ]);

      if (onAction) {
        onAction();
      }
    } catch (err) {
      setError(err.message || 'Chaos injection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🌪️</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              Chaos Engineering &bull; Resilience Lab
            </h2>
            <p className="text-[11px] text-slate-400">
              Stress-test replanning engines against random fleet disruptions & spikes
            </p>
          </div>
        </div>
        <button
          onClick={handleTriggerChaos}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
        >
          <span>{loading ? '💥' : '⚡'}</span>
          <span>{loading ? 'Injecting...' : 'Inject Chaos Event'}</span>
        </button>
      </div>

      {/* Controls: Intensity & Allowed Event Types */}
      <div className="p-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Intensity */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">Intensity:</span>
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            {['low', 'medium', 'extreme'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setIntensity(lvl)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
                  intensity === lvl
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Event Checkboxes */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-slate-300">Allowed Events:</span>
          {[
            { key: 'failure', label: 'Unit Failure' },
            { key: 'escalation', label: 'Sev Escalation' },
            { key: 'incident', label: 'Spike Incident' },
            { key: 'restore', label: 'Auto Recovery' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={allowedEvents[item.key]}
                onChange={() => toggleEvent(item.key)}
                className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 focus:outline-none"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Output & Log */}
      <div className="p-3 text-xs space-y-2">
        {error && (
          <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {lastChaosEvent ? (
          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/40 text-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                <span>💥</span> Event: {lastChaosEvent.event_type}
              </span>
              <span className="font-mono text-slate-400">
                Target: {lastChaosEvent.affected_entity}
              </span>
            </div>
            <p className="text-slate-300 text-xs">{lastChaosEvent.description}</p>
          </div>
        ) : (
          <div className="text-slate-400 italic text-center py-2 bg-slate-950/30 rounded-lg border border-dashed border-slate-800">
            Chaos engine ready. Click &quot;Inject Chaos Event&quot; to test autonomous replanning under disruption.
          </div>
        )}

        {eventHistory.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Recent Disruptions:
            </span>
            <div className="space-y-1 max-h-20 overflow-y-auto font-mono text-[11px]">
              {eventHistory.map((ev, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-slate-400 hover:text-slate-200"
                >
                  <span>
                    &bull; [{ev.timestamp}] {ev.event_type} on {ev.affected_entity}
                  </span>
                  <span className="text-slate-500">{ev.description.slice(0, 32)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

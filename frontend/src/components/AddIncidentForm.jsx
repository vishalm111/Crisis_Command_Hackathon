import React, { useState } from 'react';

const EMERGENCY_TYPES = [
  { value: 'medical', label: '🚑 Medical Emergency', defaultRequired: { ambulance: 1 } },
  { value: 'fire', label: '🚒 Fire / Structure Incident', defaultRequired: { fire_engine: 1, ambulance: 1 } },
  { value: 'rescue', label: '🛟 Search & Rescue', defaultRequired: { rescue_team: 1 } },
  { value: 'hazmat', label: '☣️ Hazardous Material', defaultRequired: { fire_engine: 1, ambulance: 1 } },
];

/**
 * AddIncidentForm provides structured and free-text emergency reporting,
 * submitting directly to POST /api/incidents with in-flight disable state,
 * error presentation, and callback triggers.
 */
export default function AddIncidentForm({
  onIncidentAdded = null,
  apiUrl = "",
  llmStatus = "disabled",
}) {
  const [mode, setMode] = useState('structured'); // 'structured' | 'free_text'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Structured form state
  const [incidentType, setIncidentType] = useState('medical');
  const [severity, setSeverity] = useState(3);
  const [peopleAffected, setPeopleAffected] = useState(1);
  const [locationLabel, setLocationLabel] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');

  // Free-text form state
  const [freeText, setFreeText] = useState('');

  const baseUrl = apiUrl || (typeof window !== 'undefined' && window.__VITE_API_URL__) || 'http://localhost:8000';

  const resetForm = () => {
    setDescription('');
    setLocationLabel('');
    setPeopleAffected(1);
    setSeverity(3);
    setFreeText('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let payload = {};

    if (mode === 'free_text') {
      if (!freeText.trim()) {
        setErrorMessage('Please provide a free-text emergency report description.');
        setIsSubmitting(false);
        return;
      }
      payload = {
        free_text: freeText.trim(),
      };
    } else {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        setErrorMessage('Coordinates must be valid floating point numbers.');
        setIsSubmitting(false);
        return;
      }

      payload = {
        type: incidentType,
        severity: parseInt(severity, 10),
        people_affected: parseInt(peopleAffected, 10) || 0,
        description: description.trim() || `${incidentType.toUpperCase()} reported at ${locationLabel || 'designated location'}`,
        location: {
          lat: parsedLat,
          lng: parsedLng,
          label: locationLabel.trim() || 'Central Emergency Sector',
        },
      };
    }

    try {
      const res = await fetch(`${baseUrl}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit incident (${res.status})`);
      }

      const createdIncident = await res.json();
      setSuccessMessage(`Incident ${createdIncident.id} successfully reported and queued for orchestration.`);
      resetForm();

      if (onIncidentAdded) {
        onIncidentAdded(createdIncident);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while submitting the incident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col text-slate-100 overflow-hidden">
      {/* Header & Mode Switcher */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <span>📝</span> Report Incident
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Submit emergency incident reports via structured dispatch or natural language text
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('structured')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              mode === 'structured'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Structured Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('free_text')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              mode === 'free_text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Free-Text (AI Parsed) 🤖
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>✅ {successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto">
        {mode === 'structured' ? (
          <div className="space-y-4">
            {/* Incident Type & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Emergency Domain
                </label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {EMERGENCY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                  <span>Severity Level</span>
                  <span className="font-mono text-indigo-400 font-bold">Level {severity} / 5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>1 (Minor)</span>
                  <span>3 (Moderate)</span>
                  <span className="text-rose-400 font-bold">5 (Catastrophic)</span>
                </div>
              </div>
            </div>

            {/* People Affected & Location Label */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Estimated Casualties / People Affected
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Location Label / Landmark
                </label>
                <input
                  type="text"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. MG Road Metro Station"
                />
              </div>
            </div>

            {/* Coordinates (Optional / Default) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="12.9716"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="77.5946"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Incident Description & Scene Context
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Details of hazards, structure collapses, injuries, or hazardous materials..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Free-Text Emergency Transmission
              </label>
              <textarea
                rows={5}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                placeholder="e.g. Multiple vehicles in collision near Richmond Circle flyover. Two passengers trapped, smoke coming from engine bay, need rescue team and ambulance fast."
              />
            </div>

            {/* AI Parsing Informational Notice / Fallback Status */}
            {llmStatus === 'enabled_ok' ? (
              <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-500/30 text-xs text-purple-300 flex items-start gap-2.5">
                <span className="text-base">✨</span>
                <div className="leading-relaxed">
                  <strong>xAI Grok Active:</strong> Emergency transmission will be parsed automatically via Grok LLM with structured JSON extraction. Missing or unverified locations will be flagged for human confirmation.
                </div>
              </div>
            ) : llmStatus === 'enabled_fallback' ? (
              <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
                <span className="text-base">🛡️</span>
                <div className="leading-relaxed">
                  <strong>LLM Fallback Active:</strong> Grok is currently unreachable, timed out, or returning fallback. Deterministic keyword parsing and rule-based safety extraction will process the incident safely.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-2.5">
                <span className="text-base">⚙️</span>
                <div className="leading-relaxed">
                  <strong>Deterministic Safety Mode (Offline):</strong> Autonomous assessment uses zero-external-dependency rule-based keyword extraction. Vague locations trigger human confirmation.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Fields
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
              isSubmitting
                ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                <span>Dispatching Incident...</span>
              </>
            ) : (
              <>
                <span>🚨</span>
                <span>Submit & Trigger Orchestration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

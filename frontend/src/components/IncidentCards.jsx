import React, { useState } from 'react';

// Optional fallback to mock_state.json when standalone
let mockIncidents = [];
try {
  // eslint-disable-next-line
  const mockState = require('../../../contracts/mock_state.json');
  mockIncidents = mockState.incidents || [];
} catch (e) {
  // If require/import not available at runtime, handled gracefully
}

const TYPE_CONFIG = {
  medical: { icon: '🚑', label: 'Medical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  fire: { icon: '🚒', label: 'Fire', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  rescue: { icon: '🛟', label: 'Rescue', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  hazmat: { icon: '☣️', label: 'Hazmat', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
};

const TIER_CONFIG = {
  critical: {
    label: 'CRITICAL',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30',
    indicator: 'bg-rose-500',
  },
  high: {
    label: 'HIGH',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40 ring-1 ring-orange-500/30',
    indicator: 'bg-orange-500',
  },
  medium: {
    label: 'MEDIUM',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30',
    indicator: 'bg-amber-500',
  },
  low: {
    label: 'LOW',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30',
    indicator: 'bg-emerald-500',
  },
};

const STATUS_CONFIG = {
  new: 'bg-slate-700/60 text-slate-300 border-slate-600',
  assessed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  en_route: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  on_scene: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  resolved: 'bg-slate-800 text-slate-400 border-slate-700',
};

/**
 * IncidentCards renders prioritized emergency incidents with severity,
 * tier indicators (text + color), priority scores, uncertain-field chips,
 * human confirmation banners, and escalation controls.
 */
export default function IncidentCards({
  incidents = null,
  onEscalate = null,
  onSelectIncident = null,
  apiUrl = "",
}) {
  const [filterTier, setFilterTier] = useState('ALL');
  const [escalatingId, setEscalatingId] = useState(null);
  const [escalateError, setEscalateError] = useState(null);

  const baseUrl = apiUrl || (typeof window !== 'undefined' && window.__VITE_API_URL__) || 'http://localhost:8000';

  // Use provided incidents prop or fall back to mock data
  const incidentList = incidents !== null ? incidents : mockIncidents;

  // Filter incidents
  const filteredIncidents = incidentList.filter((inc) => {
    if (filterTier === 'ALL') return true;
    if (filterTier === 'CONFIRMATION') return inc.needs_confirmation;
    return (inc.tier || '').toLowerCase() === filterTier.toLowerCase();
  });

  const handleEscalate = async (incident) => {
    const nextSeverity = Math.min(5, (incident.severity || 1) + 1);
    setEscalatingId(incident.id);
    setEscalateError(null);

    try {
      if (onEscalate) {
        await onEscalate(incident.id, nextSeverity);
      } else {
        const res = await fetch(`${baseUrl}/api/incidents/${incident.id}/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ severity: nextSeverity }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Escalation failed (${res.status})`);
        }
      }
    } catch (err) {
      setEscalateError(`Failed to escalate ${incident.id}: ${err.message}`);
    } finally {
      setEscalatingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col text-slate-100 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <span>🚨</span> Active Incidents
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time assessment, priority scoring, and confirmation status
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CONFIRMATION'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTier(tab)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filterTier === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab === 'CONFIRMATION' ? 'Needs Review ⚠️' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Global Error Banner */}
      {escalateError && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{escalateError}</span>
          <button
            onClick={() => setEscalateError(null)}
            className="text-rose-400 hover:text-rose-200 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Incidents Grid / List */}
      <div className="p-5 overflow-y-auto space-y-4 flex-1">
        {filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-xl mb-2 text-slate-400">
              🚒
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No Incidents Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {filterTier === 'ALL'
                ? 'No active emergencies recorded. Use the Add Incident form to report a new event.'
                : `No incidents currently match the "${filterTier}" filter criteria.`}
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => {
            const typeInfo = TYPE_CONFIG[incident.type] || {
              icon: '⚠️',
              label: incident.type,
              color: 'text-slate-300 bg-slate-800 border-slate-700',
            };
            const tierInfo = TIER_CONFIG[incident.tier?.toLowerCase()] || TIER_CONFIG.low;
            const statusClass = STATUS_CONFIG[incident.status] || STATUS_CONFIG.new;
            const isEscalating = escalatingId === incident.id;

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident && onSelectIncident(incident)}
                className={`bg-slate-950/70 border rounded-xl p-4 transition-all hover:border-slate-700 shadow-md ${
                  incident.needs_confirmation
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Needs Confirmation Safety Banner */}
                {incident.needs_confirmation && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs font-medium">
                    <span className="text-base">⚠️</span>
                    <span className="flex-1">
                      <strong>Needs Confirmation:</strong> Unverified incident location or critical attributes. Resource dispatch suspended until confirmed.
                    </span>
                  </div>
                )}

                {/* Card Top Row: ID, Type, Severity, Tier */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {incident.id}
                    </span>

                    {/* Type Badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                      <span>{typeInfo.icon}</span>
                      <span>{typeInfo.label}</span>
                    </span>

                    {/* Severity Badge */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                      Sev {incident.severity}/5
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tier Badge with BOTH Text Label and Color (Accessibility Requirement) */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wide ${tierInfo.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tierInfo.indicator}`} />
                      <span>TIER: {tierInfo.label}</span>
                    </span>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${statusClass}`}>
                      {incident.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Card Body: Description & Details */}
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-200">
                    {incident.description || 'Emergency incident reported without specific details.'}
                  </p>

                  {/* Metadata Grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* Priority Score */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority Score</span>
                      <span className="text-base font-bold text-indigo-400 font-mono">
                        {typeof incident.priority === 'number' ? incident.priority.toFixed(1) : incident.priority || '0.0'}
                      </span>
                    </div>

                    {/* People Affected */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Casualties / Affected</span>
                      <span className="text-sm font-semibold text-slate-200">
                        👥 {incident.people_affected || 0} people
                      </span>
                    </div>

                    {/* Location */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location</span>
                      <span className="text-slate-300 truncate block font-medium" title={incident.location?.label || 'Coordinates'}>
                        📍 {incident.location?.label || `${incident.location?.lat?.toFixed(3)}, ${incident.location?.lng?.toFixed(3)}`}
                      </span>
                    </div>

                    {/* Reported At */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Report Time</span>
                      <span className="text-slate-300 font-mono">
                        ⏱️ t={incident.reported_at_min || 0} min
                      </span>
                    </div>
                  </div>

                  {/* Required Resources */}
                  {incident.required && Object.keys(incident.required).length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Required:</span>
                      {Object.entries(incident.required).map(([resType, count]) => (
                        <span
                          key={resType}
                          className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60 font-mono text-[11px]"
                        >
                          {count}x {resType.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Uncertain Fields Chips */}
                  {incident.uncertain_fields && incident.uncertain_fields.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-amber-400/90">Uncertain:</span>
                      {incident.uncertain_fields.map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30"
                        >
                          <span>❓</span>
                          <span>{field}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Action Controls */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Source: <span className="font-mono text-slate-300">{incident.source || 'structured'}</span>
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEscalate(incident);
                    }}
                    disabled={isEscalating || incident.severity >= 5}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      incident.severity >= 5
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : isEscalating
                        ? 'bg-rose-900/50 text-rose-300 border border-rose-500/50 cursor-wait'
                        : 'bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/40 shadow-sm'
                    }`}
                  >
                    <span>⚡</span>
                    {isEscalating
                      ? 'Escalating...'
                      : incident.severity >= 5
                      ? 'Max Severity (5)'
                      : `Escalate to Sev ${incident.severity + 1}`}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

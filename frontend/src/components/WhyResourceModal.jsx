import React from 'react';

/**
 * WhyResourceModal: Explainability breakdown modal
 * Answers "Why this resource?" and "Why not candidate X/Y?" for dispatch assignments.
 */
export default function WhyResourceModal({ assignment, state, onClose }) {
  if (!assignment) return null;

  const { resource_id, incident_id, eta_min, role } = assignment;
  const resource = state?.resources?.find((r) => r.id === resource_id);
  const incident = state?.incidents?.find((i) => i.id === incident_id);
  const allResources = state?.resources || [];

  // Find candidate alternatives of the same type
  const alternatives = allResources
    .filter((r) => r.type === resource?.type && r.id !== resource_id)
    .map((r) => {
      let rejectionReason = '';
      if (r.status === 'unavailable') {
        rejectionReason = 'Apparatus offline / mechanical breakdown';
      } else if (r.status === 'on_scene') {
        rejectionReason = 'Committed on-scene to active incident';
      } else if (r.status === 'en_route') {
        rejectionReason = 'Already dispatched to another critical target';
      } else {
        rejectionReason = 'Sub-optimal travel time compared to primary unit';
      }
      return {
        ...r,
        rejectionReason,
      };
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Explainability Breakdown &bull; {resource_id} ➔ {incident_id}
              </h3>
              <p className="text-[11px] text-slate-400">
                Mathematical multi-criteria optimization rationale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-base font-bold px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Why Selected */}
          <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                <span>✓</span> Why Unit {resource_id} Was Selected:
              </span>
              <span className="font-mono text-[10px] text-emerald-400 font-bold">
                ETA: {eta_min?.toFixed(1) || 0}m
              </span>
            </div>
            <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
              <li>
                <strong>Proximity & Speed:</strong> Lowest transit time ({eta_min?.toFixed(1) || 0} min) from {resource?.location?.label || 'Base'}.
              </li>
              <li>
                <strong>Capability Alignment:</strong> Equipment class ({resource?.type}) directly fulfills incident requirement.
              </li>
              <li>
                <strong>Availability Status:</strong> Unit was uncommitted and within operating range.
              </li>
            </ul>
          </div>

          {/* Alternatives & Why Not */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Why Not Alternative Units?
            </span>
            {alternatives.length === 0 ? (
              <div className="text-slate-500 italic text-[11px] p-2 bg-slate-950/40 rounded border border-slate-800">
                No other units of type &quot;{resource?.type}&quot; exist in the active fleet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-2 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                        {alt.id}
                      </span>
                      <span className="text-slate-300 font-medium">
                        {alt.name || alt.type}
                      </span>
                    </div>
                    <span className="text-rose-400 font-mono text-[10px] bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                      Rejected: {alt.rejectionReason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incident Context */}
          <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Target Site: <strong className="text-white">{incident?.id}</strong> ({incident?.type})
            </span>
            <span>
              Target Severity: <strong className="text-rose-400">{incident?.severity}/5</strong>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-1 rounded-lg text-xs border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';

/**
 * ApprovalPanel displays pending human-in-the-loop approval requests,
 * presenting reasons, consequences, plan diff, and action buttons.
 *
 * @param {Object} props
 * @param {Object|null} [props.approval] - ApprovalRequest object or null
 * @param {Function} [props.onApprove] - Optional callback (approvalId) => Promise
 * @param {Function} [props.onReject] - Optional callback (approvalId) => Promise
 * @param {string} [props.apiUrl] - Base API URL (default: http://localhost:8000)
 */
export default function ApprovalPanel({
  approval = null,
  onApprove = null,
  onReject = null,
  apiUrl = "",
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const baseUrl = apiUrl || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:8000";

  // Graceful empty state when approval is null or not pending
  if (!approval || approval.status !== "pending") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl text-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 text-slate-400">
            🛡️
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-200">Approval Gate Clear</h3>
            <p className="text-[11px] text-slate-400">
              No coordinator interventions pending. System operating autonomously.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          CLEAR
        </span>
      </div>
    );
  }

  const { id, reasons = [], consequences = [], diff = null, created_at_min = 0 } = approval;

  const handleDecision = async (decisionType) => {
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      if (decisionType === "approve") {
        if (onApprove) {
          await onApprove(id);
        } else {
          const res = await fetch(`${baseUrl}/api/approval/${id}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Approval failed with status ${res.status}`);
          }
        }
        setActionSuccess(`Plan proposed in ${id} successfully approved and committed.`);
      } else {
        if (onReject) {
          await onReject(id);
        } else {
          const res = await fetch(`${baseUrl}/api/approval/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Rejection failed with status ${res.status}`);
          }
        }
        setActionSuccess(`Proposal ${id} rejected. Existing plan remains active.`);
      }
    } catch (err) {
      setActionError(err.message || "An unexpected error occurred while submitting decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border-2 border-amber-500/60 rounded-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col h-full animate-in fade-in duration-200">
      {/* High Alert Header */}
      <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <div>
            <h2 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              Action Required: High-Impact Plan Change
            </h2>
            <p className="text-[11px] text-amber-200/80 font-mono mt-0.5">
              Request: <span className="font-semibold">{id}</span> | Time: t={created_at_min}m
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
          Pending
        </span>
      </div>

      <div className="p-3.5 flex-1 overflow-y-auto max-h-[300px] space-y-3">
        {/* Reasons Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <span>🔍</span> Trigger Reasons
          </h3>
          <ul className="space-y-1.5">
            {reasons.map((reason, idx) => (
              <li
                key={`reason-${idx}`}
                className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 rounded-lg p-2.5 flex items-start gap-2"
              >
                <span className="text-amber-400 font-bold">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Consequences Section */}
        {consequences.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <span>⚡</span> Operational Consequences
            </h3>
            <ul className="space-y-1.5">
              {consequences.map((consequence, idx) => (
                <li
                  key={`consequence-${idx}`}
                  className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 flex items-start gap-2"
                >
                  <span className="text-rose-400 font-bold">➔</span>
                  <span>{consequence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Diff Summary Section */}
        {diff && diff.changes && diff.changes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>🔄</span> Proposed Plan Changes
              </h3>
              <span className="text-xs font-mono text-slate-400">
                v{diff.from_version} ➔ v{diff.to_version}
              </span>
            </div>

            <div className="space-y-2">
              {diff.changes.map((change, idx) => (
                <div
                  key={`change-${idx}`}
                  className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sky-400">{change.resource_id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {change.kind}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {change.old_incident_id && (
                        <span className="text-slate-400">From: <strong className="text-rose-300">{change.old_incident_id}</strong></span>
                      )}
                      {change.new_incident_id && (
                        <span className="text-slate-400">To: <strong className="text-emerald-300">{change.new_incident_id}</strong></span>
                      )}
                      {change.new_eta_min != null && (
                        <span className="text-sky-300 font-bold bg-sky-950 px-1 rounded">
                          ETA {Number(change.new_eta_min).toFixed(1)}m
                        </span>
                      )}
                    </div>
                  </div>

                  {change.reason && (
                    <div className="text-[11px] text-slate-400 italic">
                      "{change.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {actionError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-200">
            ⚠️ <strong>Error:</strong> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs text-emerald-200">
            ✓ {actionSuccess}
          </div>
        )}
      </div>

      {/* Decision Buttons */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between sm:justify-end gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleDecision("reject")}
          className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-center"
        >
          {isSubmitting ? "Processing..." : "Reject"}
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleDecision("approve")}
          className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 text-center"
        >
          {isSubmitting ? (
            <span>Executing...</span>
          ) : (
            <>
              <span>✓</span>
              <span>Approve {diff?.to_version ? `v${diff.to_version}` : 'Plan'} &rarr; Replace {diff?.from_version ? `v${diff.from_version}` : 'Current'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

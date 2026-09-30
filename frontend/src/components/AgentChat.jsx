import React, { useEffect, useRef, useState } from 'react';

// Optional fallback to mock_state.json when standalone
let mockMessages = [];
try {
  // eslint-disable-next-line
  const mockState = require('../../../contracts/mock_state.json');
  mockMessages = mockState.messages || [];
} catch (e) {
  // Graceful fallback
}

const AGENT_THEMES = {
  orchestrator: {
    name: 'Orchestrator',
    avatar: '👑',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    bubble: 'bg-indigo-950/30 border-indigo-500/30 text-slate-200',
  },
  assessment: {
    name: 'Assessment Agent',
    avatar: '🔍',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    bubble: 'bg-sky-950/30 border-sky-500/30 text-slate-200',
  },
  allocation: {
    name: 'Allocation Agent',
    avatar: '🧭',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    bubble: 'bg-emerald-950/30 border-emerald-500/30 text-slate-200',
  },
  impactdetector: {
    name: 'Impact Detector',
    avatar: '⚠️',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    bubble: 'bg-amber-950/30 border-amber-500/30 text-slate-200',
  },
  logistics: {
    name: 'Logistics Agent',
    avatar: '🗺️',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    bubble: 'bg-blue-950/30 border-blue-500/30 text-slate-200',
  },
  explainer: {
    name: 'Explainer Agent',
    avatar: '💡',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    bubble: 'bg-purple-950/30 border-purple-500/30 text-slate-200',
  },
  human: {
    name: 'Human Coordinator',
    avatar: '🛡️',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    bubble: 'bg-rose-950/30 border-rose-500/30 text-slate-200',
  },
};

/**
 * AgentChat renders autonomous multi-agent message feed with agent-specific badges,
 * timestamps, auto-scroll to newest, and resilient empty-state handling.
 */
export default function AgentChat({
  messages = null,
  title = "Agent Communications Feed",
}) {
  const messagesEndRef = useRef(null);
  const [filterAgent, setFilterAgent] = useState('ALL');

  const messageList = messages !== null ? messages : mockMessages;

  // Auto-scroll to newest on message update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageList]);

  const filteredMessages = messageList.filter((msg) => {
    if (filterAgent === 'ALL') return true;
    const cleanName = (msg.agent || '').toLowerCase().replace(/[\s_-]/g, '');
    return cleanName === filterAgent.toLowerCase();
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <span>💬</span> {title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inter-agent messaging, trigger logs, and dispatch notifications
          </p>
        </div>

        {/* Filter by Agent */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilterAgent('ALL')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              filterAgent === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            All ({messageList.length})
          </button>
          {['orchestrator', 'impactdetector', 'assessment', 'allocation'].map((ag) => (
            <button
              key={ag}
              onClick={() => setFilterAgent(ag)}
              className={`px-2 py-1 rounded-md font-medium transition-all capitalize ${
                filterAgent === ag
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {ag.replace('detector', ' Det.')}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="p-5 overflow-y-auto space-y-3.5 flex-1 max-h-[500px]">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-xl mb-2 text-slate-400">
              🤖
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No Messages Logged</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {filterAgent === 'ALL'
                ? 'Inter-agent communication will stream in real-time as scenario events occur.'
                : `No messages currently logged for "${filterAgent}".`}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const rawAgent = (msg.agent || '').toLowerCase().replace(/[\s_-]/g, '');
            const theme = AGENT_THEMES[rawAgent] || {
              name: msg.agent || 'Agent',
              avatar: '🤖',
              badge: 'bg-slate-800 text-slate-300 border-slate-700',
              bubble: 'bg-slate-950/50 border-slate-800 text-slate-200',
            };

            return (
              <div key={msg.id || idx} className="flex items-start gap-3">
                {/* Agent Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 shadow-sm">
                  {theme.avatar}
                </div>

                {/* Message Bubble Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border tracking-wide ${theme.badge}`}>
                      {theme.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      ⏱️ t={msg.at_min ?? 0}m
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border text-xs leading-relaxed shadow-sm ${theme.bubble}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

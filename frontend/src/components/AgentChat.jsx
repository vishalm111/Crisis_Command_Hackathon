import React, { useEffect, useRef, useState } from 'react';
import { postJson } from '../api';

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

const QUICK_QUESTIONS = [
  'What is the highest priority incident?',
  'Why was A2 chosen or considered?',
  'Which resources have failed?',
  'What is the status of I1?',
  'Is human approval required?',
];

/**
 * AgentChat:
 * Multi-agent message feed + Feature 13: Interactive Q&A grounded in live state.
 */
export default function AgentChat({
  messages = [],
  title = 'Agent Communications Feed',
}) {
  const chatContainerRef = useRef(null);
  const prevCountRef = useRef(0);
  const [filterAgent, setFilterAgent] = useState('ALL');

  // Feature 13: Interactive Q&A state
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'ask'
  const [question, setQuestion] = useState('');
  const [qaLog, setQaLog] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'feed' && messages.length > prevCountRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages.length, activeTab]);

  const filteredMessages = messages.filter((msg) => {
    if (filterAgent === 'ALL') return true;
    const cleanName = (msg.agent || '').toLowerCase().replace(/[\s_-]/g, '');
    return cleanName === filterAgent.toLowerCase();
  });

  const handleAskQuestion = async (queryText) => {
    const q = queryText || question;
    if (!q || !q.trim()) return;

    setLoading(true);
    setQuestion('');
    try {
      const res = await postJson('/chat', { message: q });
      setQaLog((prev) => [
        ...prev,
        {
          question: q,
          answer: res.answer,
          referencedEntities: res.referenced_entities || [],
          usedLlm: res.used_llm,
          time: new Date().toLocaleTimeString(),
        },
      ]);
      setActiveTab('ask');
    } catch (err) {
      setQaLog((prev) => [
        ...prev,
        {
          question: q,
          answer: `Query error: ${err.message}`,
          referencedEntities: [],
          usedLlm: false,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full text-slate-100 overflow-hidden">
      {/* Header & Tabs */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              {title}
            </h2>
            <p className="text-[11px] text-slate-400">
              Multi-agent event feed &bull; Interactive Q&A
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-2.5 py-0.5 rounded font-medium transition-all ${
              activeTab === 'feed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Feed ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            className={`px-2.5 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
              activeTab === 'ask'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Ask AI</span>
            {qaLog.length > 0 && (
              <span className="bg-purple-900 text-purple-200 text-[10px] px-1 rounded-full font-mono">
                {qaLog.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FEED TAB */}
      {activeTab === 'feed' && (
        <>
          {/* Filter by Agent */}
          <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-1 text-[11px] overflow-x-auto">
            <button
              onClick={() => setFilterAgent('ALL')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                filterAgent === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              All
            </button>
            {['orchestrator', 'impactdetector', 'assessment', 'allocation'].map((ag) => (
              <button
                key={ag}
                onClick={() => setFilterAgent(ag)}
                className={`px-1.5 py-0.5 rounded-md font-medium transition-all capitalize ${
                  filterAgent === ag
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {ag.replace('detector', ' Det.')}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div ref={chatContainerRef} className="p-3 overflow-y-auto space-y-2 flex-1 max-h-[220px]">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center text-sm mb-1 text-slate-400">
                  🤖
                </div>
                <h3 className="text-xs font-semibold text-slate-300">No Messages Logged</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inter-agent communication will stream in real-time as scenario events occur.
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
                  <div key={msg.id || idx} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                      {theme.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border tracking-wide ${theme.badge}`}>
                          {theme.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          t={msg.at_min ?? 0}m
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-xs leading-relaxed ${theme.bubble}`}>
                        {msg.text || msg.detail}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ASK AI TAB (Feature 13: Grounded Q&A) */}
      {activeTab === 'ask' && (
        <div className="flex-1 flex flex-col min-h-[220px]">
          {/* Quick Query Pills */}
          <div className="p-2 bg-slate-950/40 border-b border-slate-800/60 flex flex-wrap gap-1">
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleAskQuestion(q)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded text-[10px] border border-slate-700 transition-colors disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Q&A Conversation Flow */}
          <div className="p-3 overflow-y-auto space-y-2.5 flex-1 max-h-[170px]">
            {qaLog.length === 0 ? (
              <div className="text-center py-6 text-slate-500 italic text-xs">
                Ask any question above or type below. Answers are strictly grounded in active live state.
              </div>
            ) : (
              qaLog.map((item, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center gap-1 text-purple-300 font-semibold text-[11px]">
                    <span>👤</span>
                    <span>{item.question}</span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs leading-relaxed space-y-1">
                    <p>{item.answer}</p>
                    {item.referencedEntities?.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                        <span>Referenced:</span>
                        {item.referencedEntities.map((e) => (
                          <span key={e} className="bg-slate-800 px-1 py-0.2 rounded text-indigo-300 font-bold">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion();
            }}
            className="p-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about priority, fleet status, why units were chosen..."
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium px-3 py-1 rounded-lg text-xs transition-colors shadow-sm"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

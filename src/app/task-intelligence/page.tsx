'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Dark theme style constants
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#18253a', border: '1px solid rgba(168,184,200,0.12)',
  borderRadius: '10px', padding: '20px', fontFamily: "'DM Sans', sans-serif",
};
const SECTION_LABEL: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: '#a8b8c8', marginBottom: '6px',
};
const INPUT: React.CSSProperties = {
  fontSize: '13px', color: '#eef2f7', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(168,184,200,0.2)', borderRadius: '6px',
  padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%',
};
const TEXTAREA: React.CSSProperties = {
  fontSize: '13px', color: '#eef2f7', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(168,184,200,0.2)', borderRadius: '6px',
  padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", outline: 'none',
  width: '100%', resize: 'vertical' as const, lineHeight: 1.5,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 20px', background: '#4f8ef7', color: '#fff',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontSize: '13px', fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
  display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const BTN_GHOST: React.CSSProperties = {
  padding: '6px 14px', background: 'rgba(255,255,255,0.04)', color: '#a8b8c8',
  border: '1px solid rgba(168,184,200,0.18)', borderRadius: '6px', cursor: 'pointer',
  fontSize: '12px', fontFamily: "'DM Sans', sans-serif",
  display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const RESULT_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,184,200,0.1)',
  borderRadius: '7px', padding: '12px 14px', marginBottom: '8px',
};

// ─────────────────────────────────────────────────────────────────────────────
// Voice helper + mic icon
// ─────────────────────────────────────────────────────────────────────────────

function startVoiceRec(onResult: (t: string) => void, onEnd: () => void, onError?: () => void): { stop: () => void } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { toast.error('Voice input requires Chrome.'); throw new Error('no SR'); }
  const r = new SR();
  r.continuous = false; r.interimResults = false;
  r.onresult = (e: { results: SpeechRecognitionResultList }) => {
    onResult(Array.from(e.results).map((res: SpeechRecognitionResult) => res[0].transcript).join(' '));
  };
  r.onend = onEnd; r.onerror = onError ?? onEnd;
  r.start(); return r;
}

function MicIcon({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      title={listening ? 'Stop listening' : 'Tap to speak'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
        borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: listening ? '#22cc6e' : '#3a4a5c',
        filter: listening ? 'drop-shadow(0 0 5px rgba(34,204,110,0.7))' : 'none',
        animation: listening ? 'micPulse 1.4s ease-in-out infinite' : 'none',
      }}
    >
      <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
        <rect x="3.5" y="0.75" width="6" height="8.5" rx="3" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 8.5C1 11.54 3.46 14 6.5 14s5.5-2.46 5.5-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="6.5" y1="14" x2="6.5" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TaskResult {
  id?: string; task_number?: number; title?: string; reported_by?: string;
  status?: string; date_completed?: string; priority?: string; [key: string]: unknown;
}
interface SimResult { id: string; task_number: number; title: string; similarity: string; }

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TaskIntelligencePage() {
  // Query Completed Tasks state
  const [question, setQuestion]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<TaskResult[]>([]);
  const [sql, setSql]             = useState('');
  const [showSql, setShowSql]     = useState(false);
  const [message, setMessage]     = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  // Find Similar Tasks state
  const [simName, setSimName]             = useState('');
  const [simElab, setSimElab]             = useState('');
  const [simLoading, setSimLoading]       = useState(false);
  const [simResults, setSimResults]       = useState<SimResult[]>([]);
  const [simMessage, setSimMessage]       = useState('');
  const [listeningName, setListeningName] = useState(false);
  const [listeningElab, setListeningElab] = useState(false);
  const nameRecRef = useRef<{ stop: () => void } | null>(null);
  const elabRecRef = useRef<{ stop: () => void } | null>(null);

  function stopVoice() { recRef.current?.stop(); setListening(false); }

  async function handleQuery() {
    if (!question.trim()) { toast.error('Enter a question first.'); return; }
    setLoading(true); setResults([]); setSql(''); setMessage('');
    try {
      const res = await fetch('/api/query/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question.trim() }) });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Query failed.'); if (data.sql) setSql(data.sql); }
      else { setSql(data.sql ?? ''); setResults(data.results ?? []); if ((data.results ?? []).length === 0) setMessage('No matching tasks found.'); }
    } catch { setMessage('Query failed.'); }
    setLoading(false);
  }

  async function handleFindSimilar() {
    if (!simName.trim()) { toast.error('Enter a task name to search.'); return; }
    setSimLoading(true); setSimResults([]); setSimMessage('');
    try {
      const res = await fetch('/api/similar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskName: simName.trim(), elaboration: simElab.trim() }) });
      const data = await res.json();
      if (!res.ok) setSimMessage(data.error || 'Search failed.');
      else { setSimResults(data.results ?? []); if ((data.results ?? []).length === 0) setSimMessage(data.message || 'No similar tasks found.'); }
    } catch { setSimMessage('Search failed.'); }
    setSimLoading(false);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0f1923', padding: '32px 40px', fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#eef2f7', marginBottom: '24px' }}>Task Intelligence</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Query Completed Tasks */}
        <div style={CARD}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Query Completed Tasks</p>
          <p style={{ fontSize: '12px', color: '#a8b8c8', marginBottom: '14px' }}>
            Ask a question in plain English — IT Buddy will find the answer from your task history.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...INPUT, flex: 1 }}
              placeholder='e.g. "When did I last replace a hard drive?"'
              value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
            />
            <MicIcon listening={listening} onToggle={() => {
              if (listening) { stopVoice(); return; }
              try { recRef.current = startVoiceRec(t => setQuestion(t), () => setListening(false)); setListening(true); } catch { setListening(false); }
            }} />
            <button style={{ ...BTN_PRIMARY, opacity: loading ? 0.7 : 1 }} onClick={handleQuery} disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : 'Ask'}
            </button>
          </div>
          {sql && (
            <div style={{ marginBottom: '10px' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4a5a6b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }} onClick={() => setShowSql(v => !v)}>
                {showSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{showSql ? 'Hide' : 'Show'} generated query
              </button>
              {showSql && <pre style={{ marginTop: '6px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '10px', overflowX: 'auto', color: '#a8b8c8', fontFamily: "'DM Mono', monospace", whiteSpace: 'pre-wrap' }}>{sql}</pre>}
            </div>
          )}
          {message && <p style={{ fontSize: '12px', color: '#a8b8c8', textAlign: 'center', padding: '12px 0' }}>{message}</p>}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((r, i) => (
                <div key={r.id ?? i} style={RESULT_CARD}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: '#eef2f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.task_number ? `#${r.task_number} ` : ''}{r.title ?? JSON.stringify(r)}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: '#a8b8c8' }}>
                        {r.reported_by && <span>{r.reported_by}</span>}
                        {r.date_completed && <span>Completed {formatDate(r.date_completed)}</span>}
                        {r.status && r.status !== 'resolved' && <span style={{ textTransform: 'capitalize' }}>{(r.status as string).replace('_', ' ')}</span>}
                      </div>
                    </div>
                    {r.id && <Link href={`/issues/${r.id}`} style={{ ...BTN_GHOST, fontSize: '11px', padding: '4px 10px', flexShrink: 0 }}>Review</Link>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Find Similar Tasks */}
        <div style={CARD}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Find Similar Tasks in the Past</p>
          <p style={{ fontSize: '12px', color: '#a8b8c8', marginBottom: '14px' }}>
            Describe a task — IT Buddy will find past tasks whose solutions might help.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={SECTION_LABEL}>Task name</div>
                <input style={INPUT} placeholder="e.g. Hard drive replacement" value={simName} onChange={e => setSimName(e.target.value)} />
              </div>
              <MicIcon listening={listeningName} onToggle={() => {
                if (listeningName) { nameRecRef.current?.stop(); setListeningName(false); return; }
                try { nameRecRef.current = startVoiceRec(t => setSimName(t), () => setListeningName(false)); setListeningName(true); } catch { setListeningName(false); }
              }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={SECTION_LABEL}>Elaboration (optional)</div>
                <textarea style={{ ...TEXTAREA, minHeight: '64px' }} rows={2} placeholder="What kind of similarity are you looking for?" value={simElab} onChange={e => setSimElab(e.target.value)} />
              </div>
              <div style={{ marginTop: '18px' }}>
                <MicIcon listening={listeningElab} onToggle={() => {
                  if (listeningElab) { elabRecRef.current?.stop(); setListeningElab(false); return; }
                  try { elabRecRef.current = startVoiceRec(t => setSimElab(prev => prev ? `${prev} ${t}` : t), () => setListeningElab(false)); setListeningElab(true); } catch { setListeningElab(false); }
                }} />
              </div>
            </div>
            <button style={{ ...BTN_GHOST, width: '100%', justifyContent: 'center', opacity: simLoading ? 0.7 : 1 }} onClick={handleFindSimilar} disabled={simLoading}>
              {simLoading ? <><span className="spinner spinner-sm" /> Searching…</> : 'Find similar tasks'}
            </button>
            {simMessage && <p style={{ fontSize: '12px', color: '#a8b8c8', textAlign: 'center' }}>{simMessage}</p>}
            {simResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {simResults.map(r => (
                  <div key={r.id} style={RESULT_CARD}>
                    <Link href={`/issues/${r.id}`} style={{ fontSize: '13px', fontWeight: 600, color: '#4f8ef7', textDecoration: 'none' }}>
                      #{r.task_number} {r.title}
                    </Link>
                    <p style={{ fontSize: '11px', color: '#a8b8c8', marginTop: '4px' }}>{r.similarity}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

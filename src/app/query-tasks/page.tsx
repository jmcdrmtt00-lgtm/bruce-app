'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Mic, MicOff, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface TaskResult {
  id?: string;
  task_number?: number;
  title?: string;
  reported_by?: string;
  status?: string;
  date_completed?: string;
  priority?: string;
  [key: string]: unknown;
}

interface SimResult {
  id: string;
  task_number: number;
  title: string;
  similarity: string;
}

function formatDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QueryTasksPage() {
  // ── Natural language query ──────────────────────────────────────────────
  const [question, setQuestion]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<TaskResult[]>([]);
  const [sql, setSql]               = useState('');
  const [showSql, setShowSql]       = useState(false);
  const [message, setMessage]       = useState('');
  const [listening, setListening]   = useState(false);
  const recRef = useRef<unknown>(null);

  // ── Find Similar ────────────────────────────────────────────────────────
  const [simName, setSimName]           = useState('');
  const [simElab, setSimElab]           = useState('');
  const [simLoading, setSimLoading]     = useState(false);
  const [simResults, setSimResults]     = useState<SimResult[]>([]);
  const [simMessage, setSimMessage]     = useState('');

  function startVoice(onResult: (t: string) => void) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input requires Chrome.'); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(e.results).map((res: SpeechRecognitionResult) => res[0].transcript).join(' ');
      onResult(text);
    };
    r.onend = () => setListening(false);
    r.start();
    recRef.current = r;
    setListening(true);
  }

  function stopVoice() {
    (recRef.current as { stop: () => void } | null)?.stop();
    setListening(false);
  }

  async function handleQuery() {
    if (!question.trim()) { toast.error('Enter a question first.'); return; }
    setLoading(true);
    setResults([]);
    setSql('');
    setMessage('');
    try {
      const res = await fetch('/api/query/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Query failed.');
        if (data.sql) setSql(data.sql);
      } else {
        setSql(data.sql ?? '');
        setResults(data.results ?? []);
        if ((data.results ?? []).length === 0) setMessage('No matching tasks found.');
      }
    } catch {
      setMessage('Query failed.');
    }
    setLoading(false);
  }

  async function handleFindSimilar() {
    if (!simName.trim()) { toast.error('Enter a task name to search.'); return; }
    setSimLoading(true);
    setSimResults([]);
    setSimMessage('');
    try {
      const res = await fetch('/api/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: simName.trim(), elaboration: simElab.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setSimMessage(data.error || 'Search failed.');
      else {
        setSimResults(data.results ?? []);
        if ((data.results ?? []).length === 0) setSimMessage(data.message || 'No similar tasks found.');
      }
    } catch {
      setSimMessage('Search failed.');
    }
    setSimLoading(false);
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Query Completed Tasks ── */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">
            <h1 className="text-2xl font-bold">Query Completed Tasks</h1>
            <p className="text-base-content/60 text-sm">
              Ask a question in plain English — IT Buddy will find the answer from your task history.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder='e.g. "When did I last replace a hard drive?"'
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuery()}
              />
              <button
                className={`btn ${listening ? 'btn-error' : 'btn-outline'}`}
                onClick={() => listening ? stopVoice() : startVoice(t => setQuestion(t))}
                title={listening ? 'Stop' : 'Speak your question'}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleQuery}
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : 'Ask'}
              </button>
            </div>

            {/* Generated SQL (collapsible) */}
            {sql && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-base-content/40 hover:text-base-content/70"
                  onClick={() => setShowSql(v => !v)}
                >
                  {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showSql ? 'Hide' : 'Show'} generated query
                </button>
                {showSql && (
                  <pre className="mt-1 text-xs bg-base-200 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {sql}
                  </pre>
                )}
              </div>
            )}

            {message && (
              <p className="text-sm text-base-content/50 text-center">{message}</p>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={r.id ?? i} className="card bg-base-200 shadow-sm">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {r.task_number ? `#${r.task_number} ` : ''}{r.title ?? JSON.stringify(r)}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs text-base-content/50">
                            {r.reported_by && <span>{r.reported_by}</span>}
                            {r.date_completed && <span>Completed {formatDate(r.date_completed)}</span>}
                            {r.status && r.status !== 'resolved' && (
                              <span className="capitalize">{r.status.replace('_', ' ')}</span>
                            )}
                          </div>
                        </div>
                        {r.id && (
                          <Link
                            href={`/issues/${r.id}`}
                            className="btn btn-outline btn-xs shrink-0"
                          >
                            Review Task
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Find Similar Tasks ── */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-3">
            <h2 className="text-lg font-semibold">Find Similar Tasks in the Past</h2>

            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder="Task name"
              value={simName}
              onChange={e => setSimName(e.target.value)}
            />
            <textarea
              className="textarea textarea-bordered textarea-sm w-full text-sm"
              rows={2}
              placeholder="Elaborate on what kind of similarity you're looking for..."
              value={simElab}
              onChange={e => setSimElab(e.target.value)}
            />
            <button
              className="btn btn-outline btn-sm w-full"
              onClick={handleFindSimilar}
              disabled={simLoading}
            >
              {simLoading ? <span className="loading loading-spinner loading-sm" /> : 'Find'}
            </button>

            {simMessage && (
              <p className="text-xs text-base-content/50 text-center">{simMessage}</p>
            )}

            {simResults.length > 0 && (
              <div className="space-y-2">
                {simResults.map(r => (
                  <div key={r.id} className="bg-base-200 rounded-lg p-3">
                    <Link href={`/issues/${r.id}`} className="text-sm font-medium hover:text-primary">
                      #{r.task_number} {r.title}
                    </Link>
                    <p className="text-xs text-base-content/60 mt-0.5">{r.similarity}</p>
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

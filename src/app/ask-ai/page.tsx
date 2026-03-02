'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface AskResult {
  rephrasing:     string;
  answer:         string;
  sql:            string | null;
  supportingData: Record<string, unknown>[];
}

export default function AskAiPage() {
  useEffect(() => { fetch('/api/track-click', { method: 'POST' }).catch(() => {}); }, []);

  const [question, setQuestion] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<AskResult | null>(null);
  const [showSql,  setShowSql]  = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<unknown>(null);

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input requires Chrome.'); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(e.results).map((res: SpeechRecognitionResult) => res[0].transcript).join(' ');
      setQuestion(text);
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

  async function handleAsk() {
    if (!question.trim()) { toast.error('Enter a question first.'); return; }
    setLoading(true);
    setResult(null);
    setShowSql(false);
    try {
      const res = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Request failed.');
      } else {
        setResult(data);
      }
    } catch {
      toast.error('Request failed.');
    }
    setLoading(false);
  }

  // Derive column headers from the first row of supporting data
  const dataColumns = result?.supportingData?.length
    ? Object.keys(result.supportingData[0])
    : [];

  function formatCell(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return String(val);
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Input card */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">
            <h1 className="text-2xl font-bold">Ask the AI</h1>
            <p className="text-base-content/60 text-sm">
              Ask anything about your IT tasks or environment — IT Buddy will answer using your current in-progress tasks as context.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder='e.g. "Which of my tasks should I tackle first?"'
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleAsk()}
              />
              <button
                className={`btn btn-xs text-[7px] whitespace-nowrap shrink-0 ${
                  listening
                    ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
                    : 'bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300'
                }`}
                onClick={() => listening ? stopVoice() : startVoice()}
              >
                {listening ? 'listening' : 'not listening'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAsk}
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : 'Ask'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">

            {/* Rephrasing */}
            <div className="card bg-base-100 shadow">
              <div className="card-body p-5">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-1">
                  I interpreted your question as
                </p>
                <p className="text-base-content/80 italic">{result.rephrasing}</p>
              </div>
            </div>

            {/* Answer */}
            <div className="card bg-base-100 shadow">
              <div className="card-body p-5">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-2">
                  My advice
                </p>
                <p className="text-sm text-base-content leading-relaxed whitespace-pre-wrap">
                  {result.answer}
                </p>
              </div>
            </div>

            {/* Supporting data */}
            {result.supportingData.length > 0 && (
              <div className="card bg-base-100 shadow">
                <div className="card-body p-5">
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">
                    Supporting data
                  </p>
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          {dataColumns.map(col => (
                            <th key={col} className="text-xs capitalize">
                              {col.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.supportingData.map((row, i) => (
                          <tr key={i} className="hover">
                            {dataColumns.map(col => (
                              <td key={col} className="text-sm">
                                {formatCell(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Generated SQL (collapsible) */}
            {result.sql && (
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
                    {result.sql}
                  </pre>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}

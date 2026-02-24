'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface AssetResult {
  id?: string;
  category?: string;
  name?: string;
  notes?: string;
  make?: string;
  model?: string;
  os?: string;
  serial_number?: string;
  asset_number?: string;
  ram?: string;
  purchased?: string;
  warranty_expires?: string;
  site?: string;
  status?: string;
  [key: string]: unknown;
}

function formatDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QueryInventoryPage() {
  const [question, setQuestion]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<AssetResult[]>([]);
  const [sql, setSql]             = useState('');
  const [showSql, setShowSql]     = useState(false);
  const [message, setMessage]     = useState('');
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

  async function handleQuery() {
    if (!question.trim()) { toast.error('Enter a question first.'); return; }
    setLoading(true);
    setResults([]);
    setSql('');
    setMessage('');
    try {
      const res = await fetch('/api/query/assets', {
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
        if ((data.results ?? []).length === 0) setMessage('No matching inventory records found.');
      }
    } catch {
      setMessage('Query failed.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">
            <h1 className="text-2xl font-bold">Query Inventory</h1>
            <p className="text-base-content/60 text-sm">
              Ask a question about your IT inventory in plain English.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder='e.g. "Show me all the people with a ThinkCentre Mini"'
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuery()}
              />
              <button
                className={`btn btn-xs text-xs whitespace-nowrap shrink-0 ${listening ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' : 'bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300'}`}
                onClick={() => listening ? stopVoice() : startVoice()}
              >
                {listening ? 'listening' : 'not listening'}
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
              <div className="overflow-x-auto">
                <table className="table table-sm bg-base-100 w-full">
                  <thead>
                    <tr>
                      <th>Name / Location</th>
                      <th>Category</th>
                      <th>Make / Model</th>
                      <th>OS</th>
                      <th>Site</th>
                      <th>Purchased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.id ?? i} className="hover">
                        <td>
                          <p className="font-medium text-sm">{r.name ?? '—'}</p>
                          {r.notes && r.notes !== r.name && (
                            <p className="text-xs text-base-content/50">{r.notes}</p>
                          )}
                        </td>
                        <td className="text-xs text-base-content/50">{r.category ?? '—'}</td>
                        <td className="text-sm">
                          {[r.make, r.model].filter(Boolean).join(' ')}
                          {r.ram && <span className="text-xs text-base-content/50 ml-1">· {r.ram}</span>}
                        </td>
                        <td className="text-sm">{r.os ?? '—'}</td>
                        <td className="text-sm">{r.site ?? '—'}</td>
                        <td className="text-sm text-base-content/60">{formatDate(r.purchased)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';
import * as XLSX from 'xlsx';

interface AssetResult {
  id?: string;
  category?: string;
  assigned_to?: string;
  name?: string;
  notes?: string;
  make?: string;
  model?: string;
  os?: string;
  serial_number?: string;
  asset_number?: string;
  ram?: string;
  purchased?: string;
  install_date?: string;
  warranty_expires?: string;
  price?: number;
  site?: string;
  status?: string;
  extra?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ── Table-builder config ──────────────────────────────────────────────────────

const ASSET_CATEGORIES = ['Computer', 'iPad', 'Phone', 'Network', 'Camera', 'Printer', 'Other'];

interface FieldDef { key: string; label: string }

const ALL_FIELDS: FieldDef[] = [
  { key: 'assigned_to',      label: 'Assigned To'      },
  { key: 'name',             label: 'Name'             },
  { key: 'site',             label: 'Site'             },
  { key: 'status',           label: 'Status'           },
  { key: 'make',             label: 'Make'             },
  { key: 'model',            label: 'Model'            },
  { key: 'os',               label: 'OS'               },
  { key: 'ram',              label: 'RAM'              },
  { key: 'serial_number',    label: 'Serial Number'    },
  { key: 'asset_number',     label: 'Asset Number'     },
  { key: 'purchased',        label: 'Purchased'        },
  { key: 'price',            label: 'Price'            },
  { key: 'install_date',     label: 'Install Date'     },
  { key: 'warranty_expires', label: 'Warranty Expires' },
  { key: 'notes',            label: 'Notes'            },
];

const DATE_KEYS = new Set(['purchased', 'install_date', 'warranty_expires']);

const DEFAULT_COLS = new Set([
  'assigned_to', 'name', 'site', 'make', 'model', 'os', 'serial_number', 'asset_number', 'purchased',
]);

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function cellValue(row: AssetResult, key: string): string {
  if (key.startsWith('extra.')) {
    const subkey = key.slice(6);
    const v = row.extra?.[subkey];
    return v !== null && v !== undefined ? String(v) : '';
  }
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (DATE_KEYS.has(key)) return formatDate(v as string) ?? '';
  return String(v);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QueryInventoryPage() {
  useEffect(() => { fetch('/api/track-click', { method: 'POST' }).catch(() => {}); }, []);

  const [mode, setMode] = useState<'ask' | 'table'>('ask');

  // ── Ask mode ──────────────────────────────────────────────────────────────
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

  // ── Table mode ────────────────────────────────────────────────────────────
  const [tableCategory, setTableCategory] = useState('Computer');
  const [selectedCols, setSelectedCols]   = useState<Set<string>>(new Set(DEFAULT_COLS));
  const [tableRows, setTableRows]         = useState<AssetResult[]>([]);
  const [tableLoading, setTableLoading]   = useState(false);
  const [extraFields, setExtraFields]     = useState<FieldDef[]>([]);
  const [showMoreCols, setShowMoreCols]   = useState(false);

  function toggleCol(key: string, checked: boolean) {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function handlePopulate() {
    if (selectedCols.size === 0) { toast.error('Select at least one column.'); return; }
    setTableLoading(true);
    setTableRows([]);
    setExtraFields([]);
    setShowMoreCols(false);
    try {
      const res = await fetch('/api/assets/download');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load assets');
      const filtered = (data.assets as AssetResult[]).filter(a => a.category === tableCategory);

      // Collect extra JSONB field keys that appear in any row
      const seen = new Set<string>();
      const extras: FieldDef[] = [];
      for (const row of filtered) {
        if (row.extra && typeof row.extra === 'object') {
          for (const k of Object.keys(row.extra)) {
            if (!seen.has(k)) {
              seen.add(k);
              extras.push({ key: `extra.${k}`, label: toLabel(k) });
            }
          }
        }
      }
      setExtraFields(extras);
      setTableRows(filtered);
      if (filtered.length === 0) toast.error(`No ${tableCategory} assets found.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assets');
    }
    setTableLoading(false);
  }

  // All available fields = standard + any extra fields discovered after Populate
  const allAvailableFields = [...ALL_FIELDS, ...extraFields];
  const needsMore      = allAvailableFields.length > 15;
  const primaryFields  = needsMore ? allAvailableFields.slice(0, 14) : allAvailableFields;
  const moreFields     = needsMore ? allAvailableFields.slice(14)    : [];
  const activeCols     = allAvailableFields.filter(f => selectedCols.has(f.key));

  function downloadExcel() {
    if (!tableRows.length) return;
    const cols    = allAvailableFields.filter(f => selectedCols.has(f.key));
    const headers = cols.map(f => f.label);
    const rows    = tableRows.map(r => cols.map(f => cellValue(r, f.key)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableCategory);
    XLSX.writeFile(wb, `${tableCategory}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-base-200 py-4 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Page title — centered, above card */}
        <h1 className="text-2xl font-bold text-center mb-4">Query Inventory</h1>

        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">

            {/* Mode selector — prominent two-option choice */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'ask'   as const, title: 'Ask a Question', sub: 'Natural language query'   },
                { id: 'table' as const, title: 'Build a Table',  sub: 'Choose columns & export'  },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    mode === opt.id
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 hover:border-base-400 bg-base-100'
                  }`}
                >
                  <div className={`font-semibold text-sm ${mode === opt.id ? 'text-primary' : 'text-base-content'}`}>
                    {opt.title}
                    {mode === opt.id && (
                      <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary align-middle" />
                    )}
                  </div>
                  <div className="text-xs text-base-content/50 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* ── Ask mode ── */}
            {mode === 'ask' && (
              <>
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
                    className={`btn btn-xs text-[7px] whitespace-nowrap shrink-0 ${listening ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' : 'bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300'}`}
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
                              <p className="font-medium text-sm">{r.assigned_to ?? r.name ?? '—'}</p>
                              {r.assigned_to && r.name && (
                                <p className="text-xs text-base-content/50">{r.name}</p>
                              )}
                              {r.notes && (
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
              </>
            )}

            {/* ── Build Table mode ── */}
            {mode === 'table' && (
              <div className="space-y-4">

                {/* Asset type + action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm font-medium whitespace-nowrap">Asset Type</label>
                  <select
                    className="select select-bordered select-sm"
                    value={tableCategory}
                    onChange={e => {
                      setTableCategory(e.target.value);
                      setTableRows([]);
                      setExtraFields([]);
                      setShowMoreCols(false);
                    }}
                  >
                    {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePopulate}
                    disabled={tableLoading || selectedCols.size === 0}
                  >
                    {tableLoading
                      ? <span className="loading loading-spinner loading-xs" />
                      : 'Populate'}
                  </button>
                  {tableRows.length > 0 && (
                    <button className="btn btn-sm gap-1" onClick={downloadExcel}>
                      <Download className="w-4 h-4" />
                      Download Excel
                    </button>
                  )}
                  {tableRows.length > 0 && (
                    <span className="text-sm text-base-content/50">
                      {tableRows.length} row{tableRows.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Column selector */}
                <div className="border border-base-300 rounded-lg p-3">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">Columns</p>

                  {/* Primary fields — up to 14 checkboxes + optional More button as 15th slot */}
                  <div className="grid grid-cols-5 gap-x-4 gap-y-2">
                    {primaryFields.map(f => (
                      <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedCols.has(f.key)}
                          onChange={e => toggleCol(f.key, e.target.checked)}
                        />
                        <span className="text-sm">{f.label}</span>
                      </label>
                    ))}

                    {needsMore && (
                      <button
                        onClick={() => setShowMoreCols(v => !v)}
                        className="btn btn-outline btn-xs btn-primary self-center justify-self-start"
                      >
                        {showMoreCols ? '− Less' : '+ More'}
                      </button>
                    )}
                  </div>

                  {/* Expanded extra fields */}
                  {showMoreCols && moreFields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-base-200">
                      <div className="grid grid-cols-5 gap-x-4 gap-y-2">
                        {moreFields.map(f => (
                          <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedCols.has(f.key)}
                              onChange={e => toggleCol(f.key, e.target.checked)}
                            />
                            <span className="text-sm">{f.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Results table */}
                {tableRows.length > 0 && activeCols.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm bg-base-100 w-full">
                      <thead>
                        <tr>
                          {activeCols.map(f => <th key={f.key}>{f.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((r, i) => (
                          <tr key={i} className="hover">
                            {activeCols.map(f => (
                              <td key={f.key} className="text-sm">
                                {cellValue(r, f.key) || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

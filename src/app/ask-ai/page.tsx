'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  ...{ fontSize: '13px', color: '#eef2f7', background: 'rgba(255,255,255,0.05)' },
  border: '1px solid rgba(168,184,200,0.2)', borderRadius: '6px',
  padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", outline: 'none',
  width: '100%', resize: 'vertical', lineHeight: 1.5,
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
const BTN_SUCCESS: React.CSSProperties = {
  ...BTN_GHOST, background: 'rgba(34,204,110,0.1)', color: '#22cc6e',
  border: '1px solid rgba(34,204,110,0.25)',
};
const SELECT: React.CSSProperties = {
  fontSize: '12px', color: '#eef2f7', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(168,184,200,0.18)', borderRadius: '5px',
  padding: '5px 10px', fontFamily: "'DM Sans', sans-serif", outline: 'none', cursor: 'pointer',
};
const RESULT_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,184,200,0.1)',
  borderRadius: '7px', padding: '12px 14px', marginBottom: '8px',
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared voice helper + mic icon
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
// Inventory tab types & helpers (from ask-ai and upload-download)
// ─────────────────────────────────────────────────────────────────────────────

interface AssetResult {
  id?: string; category?: string; assigned_to?: string; name?: string; notes?: string;
  make?: string; model?: string; os?: string; serial_number?: string; asset_number?: string;
  ram?: string; purchased?: string; install_date?: string; warranty_expires?: string;
  price?: number; site?: string; status?: string; extra?: Record<string, unknown> | null;
  [key: string]: unknown;
}

const ASSET_CATEGORIES = ['Computer', 'iPad', 'Phone', 'Printer', 'Network', 'Camera', 'Other'];

interface FieldDef { key: string; label: string }

const ALL_FIELDS: FieldDef[] = [
  { key: 'assigned_to', label: 'Assigned To' }, { key: 'name', label: 'Name' },
  { key: 'site', label: 'Site' }, { key: 'status', label: 'Status' },
  { key: 'make', label: 'Make' }, { key: 'model', label: 'Model' },
  { key: 'os', label: 'OS' }, { key: 'ram', label: 'RAM' },
  { key: 'serial_number', label: 'Serial Number' }, { key: 'asset_number', label: 'Asset Number' },
  { key: 'purchased', label: 'Purchased' }, { key: 'price', label: 'Price' },
  { key: 'install_date', label: 'Install Date' }, { key: 'warranty_expires', label: 'Warranty Expires' },
  { key: 'notes', label: 'Notes' },
];
const DATE_KEYS = new Set(['purchased', 'install_date', 'warranty_expires']);
const DEFAULT_COLS = new Set(['assigned_to', 'name', 'site', 'make', 'model', 'os', 'serial_number', 'asset_number', 'purchased']);

function toLabel(key: string) { return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function cellValue(row: AssetResult, key: string): string {
  if (key.startsWith('extra.')) {
    const v = row.extra?.[key.slice(6)];
    return v !== null && v !== undefined ? String(v) : '';
  }
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (DATE_KEYS.has(key)) return formatDate(v as string) ?? '';
  return String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload/Download types & helpers (from upload-download page)
// ─────────────────────────────────────────────────────────────────────────────

interface AssetRow {
  category: string; assigned_to: string | null; name: string | null; site: string | null;
  status: 'active' | 'retired'; make: string | null; model: string | null;
  os: string | null; ram: string | null; serial_number: string | null; asset_number: string | null;
  purchased: string | null; price: number | null; install_date: string | null;
  warranty_expires: string | null; notes: string | null; extra: Record<string, unknown> | null;
}
interface SheetInfo { name: string; category: string; site: string | null; rows: AssetRow[]; selected: boolean; }

const STANDARD_FIELDS: { key: keyof AssetRow; label: string }[] = [
  { key: 'assigned_to', label: 'Assigned To' }, { key: 'name', label: 'Name' },
  { key: 'site', label: 'Site' }, { key: 'status', label: 'Status' },
  { key: 'make', label: 'Make' }, { key: 'model', label: 'Model' },
  { key: 'os', label: 'OS' }, { key: 'ram', label: 'RAM' },
  { key: 'serial_number', label: 'Serial Number' }, { key: 'asset_number', label: 'Asset Number' },
  { key: 'purchased', label: 'Purchased' }, { key: 'price', label: 'Price' },
  { key: 'install_date', label: 'Install Date' }, { key: 'warranty_expires', label: 'Warranty Expires' },
  { key: 'notes', label: 'Notes' },
];
const KNOWN_COLUMNS = [
  'notes', 'user', 'previous owner', 'location', 'assigned to', '__empty',
  'machine brand', 'brand', 'make', 'type', 'machine type', 'model',
  'os', 'ram', 'serial number', 'serial', 'asset number',
  'purchased', 'price', 'install date', 'warranty expires', 'computer name',
];
const HEADER_CLUES = [
  'notes', 'user', 'previous owner', 'location', 'name',
  'machine brand', 'brand', 'make', 'type', 'machine type', 'model',
  'os', 'ram', 'serial number', 'serial', 'asset number',
  'purchased', 'price', 'install date', 'warranty expires',
  'computer name', 'first', 'last',
  'number', 'phone number', 'mac address', 'switch', 'port', 'ip',
  'cost', 'date received', 'device id', 'model number', 'room',
];
function detectCategory(n: string): string {
  n = n.toLowerCase();
  if (n.includes('printer')) return 'Printer';
  if (n.includes('ipad') || n.includes('tablet')) return 'iPad';
  if (n.includes('camera')) return 'Camera';
  if (n.includes('network')) return 'Network';
  if (n.includes('phone')) return 'Phone';
  if (n.includes('splashtop')) return 'Other';
  return 'Computer';
}
function detectSite(n: string): string | null {
  n = n.toLowerCase();
  if (n.includes('holden') || n.includes('hrsnc')) return 'Holden';
  if (n.includes('oakdale') || n.includes('orsnc')) return 'Oakdale';
  if (n.includes('business office')) return 'Business Office';
  return null;
}
function detectStatus(n: string): 'active' | 'retired' {
  return n.toLowerCase().includes('retired') ? 'retired' : 'active';
}
function findHeaderRow(ws: XLSX.WorkSheet): number {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  let bestRow = 0, bestScore = 0;
  for (let i = 0; i < Math.min(4, raw.length); i++) {
    const row = raw[i];
    if (!Array.isArray(row)) continue;
    const score = row.filter(cell => {
      if (cell === null || cell === undefined) return false;
      const s = String(cell).toLowerCase().trim();
      return HEADER_CLUES.some(clue => s === clue || s.includes(clue));
    }).length;
    if (score > bestScore) { bestScore = score; bestRow = i; }
  }
  return bestRow;
}
function getVal(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === key.toLowerCase()) {
        const val = row[rowKey];
        if (val !== null && val !== undefined && String(val).trim() !== '') return val;
      }
    }
  }
  return null;
}
function getString(row: Record<string, unknown>, ...keys: string[]): string | null {
  const val = getVal(row, ...keys);
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim(); return s || null;
}
function fmtDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  let d: Date;
  if (val instanceof Date) { d = val; }
  else if (typeof val === 'number') { d = new Date(Math.round((val - 25569) * 86400 * 1000)); }
  else { d = new Date(String(val).trim()); }
  if (isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  if (iso.startsWith('+') || iso.startsWith('-')) return null;
  return iso.split('T')[0];
}
function parsePrice(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}
function mapAssetRow(row: Record<string, unknown>, category: string, site: string | null, status: 'active' | 'retired'): AssetRow {
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const lk = key.toLowerCase().trim();
    if (!KNOWN_COLUMNS.includes(lk)) {
      const val = row[key];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        extra[key] = val instanceof Date ? val.toISOString().split('T')[0] : val;
      }
    }
  }
  const computerName = getString(row, 'Computer Name');
  if (computerName) extra['Computer Name'] = computerName;
  return {
    category, site, status,
    assigned_to: getString(row, '__EMPTY', 'Assigned To'),
    name: getString(row, 'User', 'Location', 'Notes', 'Previous Owner'),
    make: getString(row, 'Machine Brand', 'Brand', 'Make'),
    model: getString(row, 'Type', 'Machine Type', 'Model'),
    os: getString(row, 'OS'), ram: getString(row, 'RAM'),
    serial_number: getString(row, 'Serial Number', 'Serial'),
    asset_number: getString(row, 'Asset Number'),
    purchased: fmtDate(getVal(row, 'Purchased')),
    price: parsePrice(getVal(row, 'Price')),
    install_date: fmtDate(getVal(row, 'Install Date')),
    warranty_expires: fmtDate(getVal(row, 'Warranty Expires')),
    notes: null, extra: Object.keys(extra).length > 0 ? extra : null,
  };
}
function hasData(r: AssetRow): boolean {
  return !!(r.name || r.serial_number || r.make || r.model || r.os || r.ram || r.asset_number || r.price || r.purchased || r.install_date || r.warranty_expires || r.notes || (r.extra && Object.keys(r.extra).length > 0));
}
function parseInventoryFile(file: File): Promise<SheetInfo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellText: false });
        const sheets: SheetInfo[] = [];
        for (const sheetName of wb.SheetNames) {
          const category = detectCategory(sheetName);
          const site = detectSite(sheetName);
          const status = detectStatus(sheetName);
          const ws = wb.Sheets[sheetName];
          const headerRow = findHeaderRow(ws);
          const allArrays = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, range: headerRow });
          if (allArrays.length < 2) continue;
          const headerCells = allArrays[0] as unknown[];
          const rawRows = (allArrays.slice(1) as unknown[][]).map(rowArr => {
            const obj: Record<string, unknown> = {};
            headerCells.forEach((h, i) => {
              const key = (h === null || h === undefined || String(h).trim() === '')
                ? (i === 0 ? 'Assigned To' : `__col_${i}`)
                : String(h).trim();
              obj[key] = rowArr[i] ?? null;
            });
            return obj;
          });
          const rows = rawRows.map(r => mapAssetRow(r, category, site, status)).filter(hasData);
          if (rows.length === 0) continue;
          sheets.push({ name: sheetName, category, site, rows, selected: true });
        }
        resolve(sheets);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
async function downloadInventory() {
  const res = await fetch('/api/assets/download');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Download failed');
  const assets: AssetRow[] = data.assets;
  if (assets.length === 0) throw new Error('No assets in database yet.');
  const byCategory = new Map<string, AssetRow[]>();
  for (const asset of assets) {
    const cat = asset.category || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(asset);
  }
  const wb = XLSX.utils.book_new();
  for (const [category, rows] of byCategory) {
    const extraKeys: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.extra) for (const k of Object.keys(row.extra)) if (!seen.has(k)) { seen.add(k); extraKeys.push(k); }
    }
    const headers = [...STANDARD_FIELDS.map(f => f.label), ...extraKeys];
    const sheetData: unknown[][] = [headers];
    for (const row of rows) {
      sheetData.push([...STANDARD_FIELDS.map(f => row[f.key] ?? ''), ...extraKeys.map(k => row.extra?.[k] ?? '')]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), category.slice(0, 31));
  }
  XLSX.writeFile(wb, `IT_Buddy_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  return assets.length;
}

// Task upload/download helpers
const TASK_COLUMN_MAP: Record<string, string> = {
  'task #': 'task_number', 'task number': 'task_number', 'task name': 'task_name',
  'name': 'task_name', 'requester': 'requester', 'urgency': 'priority', 'priority': 'priority',
  'date due': 'date_due', 'due date': 'date_due', 'target date': 'date_due',
  'status': 'status', 'task type': 'task_type',
  'information needed': 'information_needed', 'info needed': 'information_needed',
  'problem to fix': 'problem_to_fix', 'decision to make': 'decision_to_make',
  'project to manage': 'project_to_manage', 'results': 'results',
  'issues/comments': 'issues_comments', 'issues': 'issues_comments', 'comments': 'issues_comments',
};
interface TaskRow {
  task_number?: string; task_name?: string; requester?: string; priority?: string;
  date_due?: string; status?: string; task_type?: string; information_needed?: string;
  problem_to_fix?: string; decision_to_make?: string; project_to_manage?: string;
  results?: string; issues_comments?: string;
}
interface DownloadTask {
  task_number: number | null; task_name: string | null; requester: string | null;
  priority: string | null; date_due: string | null; status: string | null;
  task_type: string | null; information_needed: string | null;
  problem_to_fix: string | null; decision_to_make: string | null; project_to_manage: string | null;
}
function fmtTaskDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
function parseTaskFile(file: File): Promise<TaskRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellText: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        const rows: TaskRow[] = raw.map(row => {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            const canonical = TASK_COLUMN_MAP[k.toLowerCase().trim()];
            if (canonical && v !== null && v !== undefined) {
              mapped[canonical] = canonical === 'date_due' ? (fmtTaskDate(v) ?? '') : String(v).trim();
            }
          }
          return mapped as TaskRow;
        }).filter(r => r.task_name || r.task_number);
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
async function downloadTasks() {
  const res = await fetch('/api/tasks');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Download failed');
  const tasks: DownloadTask[] = data.tasks;
  if (tasks.length === 0) throw new Error('No tasks in database yet.');
  const headers = ['Task #', 'Task Name', 'Requester', 'Urgency', 'Target Date', 'Status', 'Task type', 'Information Needed', 'Problem to fix', 'Decision to make', 'Project to manage'];
  const rows = [headers, ...tasks.map(t => [
    t.task_number ?? '', t.task_name ?? '', t.requester ?? '', t.priority ?? '',
    t.date_due ?? '', t.status ?? '', t.task_type ?? '',
    t.information_needed ?? '', t.problem_to_fix ?? '', t.decision_to_make ?? '', t.project_to_manage ?? '',
  ])];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Tasks');
  XLSX.writeFile(wb, `IT_Buddy_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
  return tasks.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — Inventory
// ─────────────────────────────────────────────────────────────────────────────

function InventoryTab() {
  const [mode, setMode] = useState<'browse' | 'ask'>('browse');

  // Ask mode state
  const [question, setQuestion]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<AssetResult[]>([]);
  const [sql, setSql]             = useState('');
  const [showSql, setShowSql]     = useState(false);
  const [message, setMessage]     = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  // Browse mode state
  const [tableCategory, setTableCategory]   = useState('Computer');
  const [selectedCols, setSelectedCols]     = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('inventory-cols');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set(DEFAULT_COLS);
  });
  const [tableRows, setTableRows]           = useState<AssetResult[]>([]);
  const [tableLoading, setTableLoading]     = useState(false);
  const [extraFields, setExtraFields]       = useState<FieldDef[]>([]);
  const [showMoreCols, setShowMoreCols]     = useState(false);

  // Auto-load assets on browse mode mount
  useEffect(() => {
    if (mode !== 'browse') return;
    let cancelled = false;
    setTableLoading(true);
    fetch('/api/assets/download').then(r => r.json()).then(data => {
      if (cancelled || !data.assets) { setTableLoading(false); return; }
      const filtered = (data.assets as AssetResult[]).filter((a: AssetResult) => a.category === tableCategory);
      const seen = new Set<string>(); const extras: FieldDef[] = [];
      for (const row of filtered) {
        if (row.extra && typeof row.extra === 'object') {
          for (const k of Object.keys(row.extra as Record<string, unknown>)) {
            if (!seen.has(k)) { seen.add(k); extras.push({ key: `extra.${k}`, label: toLabel(k) }); }
          }
        }
      }
      setExtraFields(extras); setTableRows(filtered); setTableLoading(false);
    }).catch(() => setTableLoading(false));
    return () => { cancelled = true; };
  }, [mode, tableCategory]);

  function stopVoice() { recRef.current?.stop(); setListening(false); }

  async function handleQuery() {
    if (!question.trim()) { toast.error('Enter a question first.'); return; }
    setLoading(true); setResults([]); setSql(''); setMessage('');
    try {
      const res = await fetch('/api/query/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question.trim() }) });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Query failed.'); if (data.sql) setSql(data.sql); }
      else { setSql(data.sql ?? ''); setResults(data.results ?? []); if ((data.results ?? []).length === 0) setMessage('No matching inventory records found.'); }
    } catch { setMessage('Query failed.'); }
    setLoading(false);
  }

  function toggleCol(key: string, checked: boolean) {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      try { localStorage.setItem('inventory-cols', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function downloadExcel() {
    if (!tableRows.length) return;
    const allAvailable = [...ALL_FIELDS, ...extraFields];
    const cols = allAvailable.filter(f => selectedCols.has(f.key));
    const ws = XLSX.utils.aoa_to_sheet([cols.map(f => f.label), ...tableRows.map(r => cols.map(f => cellValue(r, f.key)))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableCategory);
    XLSX.writeFile(wb, `${tableCategory}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const allAvailableFields = [...ALL_FIELDS, ...extraFields];
  const needsMore = allAvailableFields.length > 15;
  const primaryFields = needsMore ? allAvailableFields.slice(0, 14) : allAvailableFields;
  const moreFields = needsMore ? allAvailableFields.slice(14) : [];
  const activeCols = allAvailableFields.filter(f => selectedCols.has(f.key));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {([
          { id: 'browse' as const, label: 'Browse / Edit', sub: 'View and filter the database' },
          { id: 'ask'    as const, label: 'Ask a Question', sub: 'Natural language query' },
        ]).map(opt => (
          <button
            key={opt.id} onClick={() => setMode(opt.id)}
            style={{
              flex: 1, textAlign: 'left', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
              border: mode === opt.id ? '1.5px solid #4f8ef7' : '1px solid rgba(168,184,200,0.15)',
              background: mode === opt.id ? 'rgba(79,142,247,0.08)' : 'rgba(255,255,255,0.02)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: mode === opt.id ? '#4f8ef7' : '#eef2f7', marginBottom: '2px' }}>
              {opt.label}
            </div>
            <div style={{ fontSize: '11px', color: '#a8b8c8' }}>{opt.sub}</div>
          </button>
        ))}
      </div>

      {/* ── Browse mode ── */}
      {mode === 'browse' && (
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={SECTION_LABEL}>Asset type</div>
              <select style={SELECT} value={tableCategory} onChange={e => { setTableCategory(e.target.value); setTableRows([]); setExtraFields([]); setShowMoreCols(false); }}>
                {ASSET_CATEGORIES.map(c => <option key={c} style={{ background: '#1a2535' }}>{c}</option>)}
              </select>
            </div>
            {tableRows.length > 0 && (
              <button style={{ ...BTN_GHOST, marginTop: '16px' }} onClick={downloadExcel}>
                <Download size={13} /> Download Excel
              </button>
            )}
            {tableRows.length > 0 && (
              <span style={{ marginTop: '16px', fontSize: '11px', color: '#a8b8c8', fontFamily: "'DM Mono', monospace" }}>
                {tableRows.length} record{tableRows.length !== 1 ? 's' : ''}
              </span>
            )}
            {tableLoading && <span style={{ marginTop: '16px', fontSize: '11px', color: '#a8b8c8' }}>Loading…</span>}
          </div>

          {/* Column picker */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '12px', marginBottom: '14px', border: '1px solid rgba(168,184,200,0.08)' }}>
            <p style={{ ...SECTION_LABEL, marginBottom: '10px' }}>Columns</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 60px' }}>
              {primaryFields.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', color: '#a8b8c8', fontFamily: "'DM Sans', sans-serif" }}>
                  <input type="checkbox" checked={selectedCols.has(f.key)} onChange={e => toggleCol(f.key, e.target.checked)} style={{ cursor: 'pointer', accentColor: '#4f8ef7' }} />
                  {f.label}
                </label>
              ))}
              {needsMore && (
                <button onClick={() => setShowMoreCols(v => !v)} style={{ ...BTN_GHOST, fontSize: '11px', padding: '3px 10px' }}>
                  {showMoreCols ? '− Less' : '+ More'}
                </button>
              )}
            </div>
            {showMoreCols && moreFields.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(168,184,200,0.08)', display: 'flex', flexWrap: 'wrap', gap: '6px 60px' }}>
                {moreFields.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', color: '#a8b8c8', fontFamily: "'DM Sans', sans-serif" }}>
                    <input type="checkbox" checked={selectedCols.has(f.key)} onChange={e => toggleCol(f.key, e.target.checked)} style={{ cursor: 'pointer', accentColor: '#4f8ef7' }} />
                    {f.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          {tableRows.length > 0 && activeCols.length > 0 && (
            <div style={{ overflowX: 'auto' }} data-theme="light">
              <table className="table table-sm w-full" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>{activeCols.map(f => <th key={f.key} style={{ whiteSpace: 'nowrap' }}>{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className="hover">
                      {activeCols.map(f => <td key={f.key} style={{ whiteSpace: 'nowrap' }}>{cellValue(r, f.key) || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!tableLoading && tableRows.length === 0 && (
            <p style={{ fontSize: '12px', color: '#4a5a6b', textAlign: 'center', padding: '32px 0' }}>No {tableCategory} records found.</p>
          )}
        </div>
      )}

      {/* ── Ask mode ── */}
      {mode === 'ask' && (
        <div style={CARD}>
          <p style={{ fontSize: '12px', color: '#a8b8c8', marginBottom: '14px' }}>
            Ask a question in plain English — IT Buddy will query the inventory database and show you the results.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...INPUT, flex: 1 }}
              placeholder='e.g. "Show me all the people with a ThinkCentre Mini"'
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
            <div style={{ overflowX: 'auto' }} data-theme="light">
              <table className="table table-sm w-full" style={{ fontSize: '12px' }}>
                <thead><tr><th>Name / Location</th><th>Category</th><th>Make / Model</th><th>OS</th><th>Site</th><th>Purchased</th></tr></thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id ?? i} className="hover">
                      <td><p className="font-medium text-sm">{r.assigned_to ?? r.name ?? '—'}</p>{r.assigned_to && r.name && <p className="text-xs text-base-content/50">{r.name}</p>}</td>
                      <td className="text-xs text-base-content/50">{r.category ?? '—'}</td>
                      <td className="text-sm">{[r.make, r.model].filter(Boolean).join(' ')}{r.ram && <span className="text-xs text-base-content/50 ml-1">· {r.ram}</span>}</td>
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
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — Data Tools (upload/download, visually de-emphasized)
// ─────────────────────────────────────────────────────────────────────────────

function DataToolsTab() {
  // Inventory state
  const [invDownloading, setInvDownloading] = useState(false);
  const invFileRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets]             = useState<SheetInfo[]>([]);
  const [invFileName, setInvFileName]   = useState('');
  const [uploading, setUploading]       = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [invError, setInvError]         = useState<string | null>(null);

  // Tasks state
  const [taskDownloading, setTaskDownloading] = useState(false);
  const taskFileRef = useRef<HTMLInputElement>(null);
  const [taskFileName, setTaskFileName]       = useState('');
  const [taskRows, setTaskRows]               = useState<TaskRow[]>([]);
  const [taskUploading, setTaskUploading]     = useState(false);
  const [taskUploadResult, setTaskUploadResult] = useState<{ inserted: number; issues?: number; tickets?: number } | null>(null);
  const [taskError, setTaskError]             = useState<string | null>(null);

  async function handleInvDownload() {
    setInvDownloading(true);
    try { const n = await downloadInventory(); toast.success(`Downloaded ${n} assets.`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed.'); }
    setInvDownloading(false);
  }
  async function handleInvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setInvFileName(file.name); setUploadResult(null); setInvError(null);
    try { setSheets(await parseInventoryFile(file)); }
    catch (err) { setInvError('File parse error: ' + (err instanceof Error ? err.message : String(err))); }
  }
  function toggleSheet(i: number) { setSheets(prev => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s)); }
  function changeCategory(i: number, cat: string) {
    setSheets(prev => prev.map((s, idx) => idx === i ? { ...s, category: cat, rows: s.rows.map(r => ({ ...r, category: cat })) } : s));
  }
  async function handleInvUpload() {
    const selected = sheets.filter(s => s.selected && s.rows.length > 0);
    if (selected.length === 0) { toast.error('No sheets selected.'); return; }
    setUploading(true); setInvError(null); setUploadResult(null);
    try {
      const res = await fetch('/api/assets/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assets: selected.flatMap(s => s.rows) }) });
      const data = await res.json();
      if (!res.ok) setInvError(data.error || 'Upload failed.');
      else { setUploadResult(data); toast.success(`${data.inserted} added, ${data.updated} updated.`); }
    } catch (err) { setInvError('Network error: ' + (err instanceof Error ? err.message : String(err))); }
    setUploading(false);
  }
  const selectedCount = sheets.filter(s => s.selected).reduce((n, s) => n + s.rows.length, 0);

  async function handleTaskDownload() {
    setTaskDownloading(true);
    try { const n = await downloadTasks(); toast.success(`Downloaded ${n} tasks.`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed.'); }
    setTaskDownloading(false);
  }
  async function handleTaskFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setTaskFileName(file.name); setTaskUploadResult(null); setTaskError(null);
    try { setTaskRows(await parseTaskFile(file)); }
    catch (err) { setTaskError('File parse error: ' + (err instanceof Error ? err.message : String(err))); }
  }
  async function handleTaskUpload() {
    if (taskRows.length === 0) { toast.error('No rows to upload.'); return; }
    setTaskUploading(true); setTaskError(null); setTaskUploadResult(null);
    try {
      const res = await fetch('/api/tasks/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: taskRows }) });
      const data = await res.json();
      if (!res.ok) setTaskError(data.error || 'Upload failed.');
      else { setTaskUploadResult(data); toast.success(`${data.inserted} tasks loaded.`); }
    } catch (err) { setTaskError('Network error: ' + (err instanceof Error ? err.message : String(err))); }
    setTaskUploading(false);
  }

  const dropZoneStyle: React.CSSProperties = {
    border: '2px dashed rgba(168,184,200,0.2)', borderRadius: '8px', padding: '28px',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

      {/* Inventory */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#a8b8c8' }}>Inventory</p>

        {/* Download */}
        <div style={CARD}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Download</p>
          <p style={{ fontSize: '11px', color: '#a8b8c8', marginBottom: '12px' }}>Export everything to Excel — one sheet per asset category.</p>
          <button style={{ ...BTN_SUCCESS, opacity: invDownloading ? 0.7 : 1 }} onClick={handleInvDownload} disabled={invDownloading}>
            {invDownloading ? <span className="spinner spinner-sm" /> : <><Download size={13} /> Download to Excel</>}
          </button>
        </div>

        {/* Upload */}
        <div style={CARD}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Upload</p>
          <p style={{ fontSize: '11px', color: '#a8b8c8', marginBottom: '12px' }}>Select an Excel file. IT Buddy detects each sheet&apos;s asset type automatically.</p>
          <div style={dropZoneStyle} onClick={() => invFileRef.current?.click()}>
            {invFileName
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#a8b8c8' }}><FileSpreadsheet size={16} /><span style={{ fontSize: '13px' }}>{invFileName}</span></div>
              : <div style={{ color: '#3a4a5c' }}><Upload size={24} style={{ margin: '0 auto 8px' }} /><p style={{ fontSize: '12px' }}>Click to select an Excel file</p></div>
            }
          </div>
          <input ref={invFileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleInvFileChange} />
        </div>

        {sheets.length > 0 && (
          <div style={CARD}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#eef2f7', marginBottom: '10px' }}>Detected sheets</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {sheets.map((s, i) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,184,200,0.1)' }}>
                  <input type="checkbox" checked={s.selected} onChange={() => toggleSheet(i)} style={{ cursor: 'pointer', accentColor: '#4f8ef7' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', color: '#eef2f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    {s.site && <p style={{ fontSize: '10px', color: '#a8b8c8' }}>{s.site}</p>}
                  </div>
                  <select style={{ ...SELECT, fontSize: '11px', padding: '3px 8px' }} value={s.category} onChange={e => changeCategory(i, e.target.value)} onClick={e => e.stopPropagation()}>
                    {ASSET_CATEGORIES.map(c => <option key={c} style={{ background: '#1a2535' }}>{c}</option>)}
                  </select>
                  <span style={{ fontSize: '10px', color: '#4a5a6b', fontFamily: "'DM Mono', monospace", minWidth: '40px', textAlign: 'right' }}>{s.rows.length}r</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#a8b8c8' }}>{selectedCount} assets selected</span>
              <button style={{ ...BTN_PRIMARY, opacity: uploading || selectedCount === 0 ? 0.5 : 1 }} onClick={handleInvUpload} disabled={uploading || selectedCount === 0}>
                {uploading ? <span className="spinner spinner-sm" /> : <><Upload size={13} /> Upload</>}
              </button>
            </div>
          </div>
        )}
        {invError && <div style={{ ...CARD, border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.05)' }}><p style={{ fontSize: '12px', color: '#ff6060', fontWeight: 600, marginBottom: '4px' }}>Upload failed</p><p style={{ fontSize: '11px', color: '#a8b8c8' }}>{invError}</p></div>}
        {uploadResult && <div style={{ ...CARD, border: '1px solid rgba(34,204,110,0.2)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22cc6e', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}><CheckCircle size={16} /> Upload complete</div><p style={{ fontSize: '11px', color: '#a8b8c8' }}>{uploadResult.inserted} added, {uploadResult.updated} updated.</p></div>}
      </div>

      {/* Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#a8b8c8' }}>Tasks</p>

        {/* Download */}
        <div style={CARD}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Download</p>
          <p style={{ fontSize: '11px', color: '#a8b8c8', marginBottom: '12px' }}>Export your current task list to Excel.</p>
          <button style={{ ...BTN_SUCCESS, opacity: taskDownloading ? 0.7 : 1 }} onClick={handleTaskDownload} disabled={taskDownloading}>
            {taskDownloading ? <span className="spinner spinner-sm" /> : <><Download size={13} /> Download to Excel</>}
          </button>
        </div>

        {/* Upload */}
        <div style={CARD}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#eef2f7', marginBottom: '4px' }}>Upload</p>
          <p style={{ fontSize: '11px', color: '#a8b8c8', marginBottom: '12px' }}>Select an Excel or CSV file. Replaces all existing tasks for your account.</p>
          <div style={dropZoneStyle} onClick={() => taskFileRef.current?.click()}>
            {taskFileName
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#a8b8c8' }}><FileSpreadsheet size={16} /><span style={{ fontSize: '13px' }}>{taskFileName}</span>{taskRows.length > 0 && <span style={{ fontSize: '11px', color: '#a8b8c8' }}>({taskRows.length} rows)</span>}</div>
              : <div style={{ color: '#3a4a5c' }}><Upload size={24} style={{ margin: '0 auto 8px' }} /><p style={{ fontSize: '12px' }}>Click to select a file</p></div>
            }
          </div>
          <input ref={taskFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleTaskFileChange} />
          {taskRows.length > 0 && (
            <button style={{ ...BTN_PRIMARY, marginTop: '10px', width: '100%', justifyContent: 'center', opacity: taskUploading ? 0.7 : 1 }} onClick={handleTaskUpload} disabled={taskUploading}>
              {taskUploading ? <span className="spinner spinner-sm" /> : <><Upload size={13} /> Upload {taskRows.length} tasks</>}
            </button>
          )}
        </div>

        {taskError && <div style={{ ...CARD, border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.05)' }}><p style={{ fontSize: '12px', color: '#ff6060', fontWeight: 600, marginBottom: '4px' }}>Upload failed</p><p style={{ fontSize: '11px', color: '#a8b8c8' }}>{taskError}</p></div>}
        {taskUploadResult && <div style={{ ...CARD, border: '1px solid rgba(34,204,110,0.2)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22cc6e', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}><CheckCircle size={16} /> Upload complete</div><p style={{ fontSize: '11px', color: '#a8b8c8' }}>{taskUploadResult.inserted} tasks loaded — {taskUploadResult.issues ?? '?'} dashboard tasks, {taskUploadResult.tickets ?? '?'} tickets.</p></div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  useEffect(() => { fetch('/api/track-click', { method: 'POST' }).catch(() => {}); }, []);
  const [tab, setTab] = useState<'inventory' | 'tools'>('inventory');

  return (
    <main style={{ minHeight: '100vh', background: '#111a26', fontFamily: "'DM Sans', sans-serif", padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(168,184,200,0.15)', marginBottom: '28px' }}>
          <button onClick={() => setTab('inventory')} style={{
            padding: '10px 22px', border: 'none', background: 'none',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500,
            color: tab === 'inventory' ? '#4f8ef7' : '#a8b8c8',
            borderBottom: `2px solid ${tab === 'inventory' ? '#4f8ef7' : 'transparent'}`,
            cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
          }}>
            Inventory
          </button>
          {/* Data Tools — visually de-emphasized */}
          <button onClick={() => setTab('tools')} style={{
            padding: '10px 22px', border: 'none', background: 'none',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500,
            color: tab === 'tools' ? '#a8b8c8' : '#3a4a5c',
            borderBottom: `2px solid ${tab === 'tools' ? '#a8b8c8' : 'transparent'}`,
            cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            Data Tools
            <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#3a4a5c', background: 'rgba(168,184,200,0.06)', border: '1px solid rgba(168,184,200,0.12)', borderRadius: '3px', padding: '1px 5px', lineHeight: '14px' }}>
              Admin
            </span>
          </button>
        </div>

        {tab === 'inventory' && <InventoryTab />}
        {tab === 'tools'     && <DataToolsTab />}
      </div>
    </main>
  );
}

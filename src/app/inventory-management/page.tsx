'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['Computer', 'Printer', 'Phone', 'iPad', 'Camera', 'Network', 'Other'];

// ── Shared types ───────────────────────────────────────────────────────────────

interface AssetRow {
  category: string;
  name: string | null;
  site: string | null;
  status: 'active' | 'retired';
  make: string | null;
  model: string | null;
  os: string | null;
  ram: string | null;
  serial_number: string | null;
  asset_number: string | null;
  purchased: string | null;
  price: number | null;
  install_date: string | null;
  warranty_expires: string | null;
  notes: string | null;
  extra: Record<string, unknown> | null;
}

interface SheetInfo {
  name: string;
  category: string;
  site: string | null;
  rows: AssetRow[];
  selected: boolean;
}

// ── Detection helpers ──────────────────────────────────────────────────────────

function detectCategory(sheetName: string): string {
  const n = sheetName.toLowerCase();
  if (n.includes('printer')) return 'Printer';
  if (n.includes('ipad') || n.includes('tablet')) return 'iPad';
  if (n.includes('camera')) return 'Camera';
  if (n.includes('network')) return 'Network';
  if (n.includes('phone')) return 'Phone';
  if (n.includes('splashtop')) return 'Other';
  return 'Computer';
}

function detectSite(sheetName: string): string | null {
  const n = sheetName.toLowerCase();
  if (n.includes('holden') || n.includes('hrsnc')) return 'Holden';
  if (n.includes('oakdale') || n.includes('orsnc')) return 'Oakdale';
  if (n.includes('business office')) return 'Business Office';
  if (n.includes('it office')) return 'IT Office';
  return null;
}

function detectStatus(sheetName: string): 'active' | 'retired' {
  return sheetName.toLowerCase().includes('retired') ? 'retired' : 'active';
}

// ── Row mapping ────────────────────────────────────────────────────────────────

const KNOWN_COLUMNS = [
  'notes', 'user', 'previous owner', 'location',
  'machine brand', 'brand', 'make',
  'type', 'machine type', 'model',
  'os', 'ram',
  'serial number', 'serial',
  'asset number',
  'purchased', 'price', 'install date', 'warranty expires',
  'computer name',
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

function findHeaderRow(ws: XLSX.WorkSheet): number {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(4, raw.length); i++) {
    const row = raw[i];
    if (!Array.isArray(row)) continue;
    const score = row.filter((cell) => {
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
  const s = String(val).trim();
  return s || null;
}

function formatDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    d = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else {
    d = new Date(String(val).trim());
  }
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

function mapRow(
  row: Record<string, unknown>,
  category: string,
  site: string | null,
  status: 'active' | 'retired'
): AssetRow {
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
    category,
    name: getString(row, 'User', 'Location', 'Notes', 'Previous Owner'),
    site,
    status,
    make: getString(row, 'Machine Brand', 'Brand', 'Make'),
    model: getString(row, 'Type', 'Machine Type', 'Model'),
    os: getString(row, 'OS'),
    ram: getString(row, 'RAM'),
    serial_number: getString(row, 'Serial Number', 'Serial'),
    asset_number: getString(row, 'Asset Number'),
    purchased: formatDate(getVal(row, 'Purchased')),
    price: parsePrice(getVal(row, 'Price')),
    install_date: formatDate(getVal(row, 'Install Date')),
    warranty_expires: formatDate(getVal(row, 'Warranty Expires')),
    notes: null,
    extra: Object.keys(extra).length > 0 ? extra : null,
  };
}

function hasData(r: AssetRow): boolean {
  return !!(
    r.name || r.serial_number || r.make || r.model ||
    r.os || r.ram || r.asset_number || r.price ||
    r.purchased || r.install_date || r.warranty_expires || r.notes ||
    (r.extra && Object.keys(r.extra).length > 0)
  );
}

// ── Parse Excel file ───────────────────────────────────────────────────────────

function parseFile(file: File): Promise<SheetInfo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        let wb: XLSX.WorkBook;
        try {
          wb = XLSX.read(data, { type: 'array', cellText: false });
        } catch (readErr) {
          reject(new Error('XLSX read failed: ' + (readErr instanceof Error ? readErr.message : String(readErr))));
          return;
        }
        const sheets: SheetInfo[] = [];
        for (const sheetName of wb.SheetNames) {
          const category = detectCategory(sheetName);
          const site = detectSite(sheetName);
          const status = detectStatus(sheetName);
          const ws = wb.Sheets[sheetName];
          const headerRow = findHeaderRow(ws);
          let rawRows: Record<string, unknown>[];
          try {
            rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
              defval: null,
              range: headerRow,
            });
          } catch {
            rawRows = [];
          }
          if (rawRows.length === 0) continue;
          const rows = rawRows.map(r => mapRow(r, category, site, status)).filter(hasData);
          if (rows.length === 0) continue;
          sheets.push({ name: sheetName, category, site, rows, selected: true });
        }
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Download: write database contents to Excel ────────────────────────────────

const STANDARD_FIELDS: { key: keyof AssetRow; label: string }[] = [
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

async function buildAndDownload() {
  const res = await fetch('/api/assets/download');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Download failed');

  const assets: AssetRow[] = data.assets;
  if (assets.length === 0) throw new Error('No assets in database yet.');

  // Group by category
  const byCategory = new Map<string, AssetRow[]>();
  for (const asset of assets) {
    const cat = asset.category || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(asset);
  }

  const wb = XLSX.utils.book_new();

  for (const [category, rows] of byCategory) {
    // Collect all extra-field keys that appear in this category
    const extraKeys: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.extra) {
        for (const k of Object.keys(row.extra)) {
          if (!seen.has(k)) { seen.add(k); extraKeys.push(k); }
        }
      }
    }

    // Build header row
    const headers = [
      ...STANDARD_FIELDS.map(f => f.label),
      ...extraKeys,
    ];

    // Build data rows
    const sheetData: unknown[][] = [headers];
    for (const row of rows) {
      sheetData.push([
        ...STANDARD_FIELDS.map(f => row[f.key] ?? ''),
        ...extraKeys.map(k => row.extra?.[k] ?? ''),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    // Truncate sheet name to Excel's 31-char limit
    XLSX.utils.book_append_sheet(wb, ws, category.slice(0, 31));
  }

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `IT_Buddy_Inventory_${date}.xlsx`);
  return assets.length;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function InventoryManagementPage() {
  // Download state
  const [downloading, setDownloading] = useState(false);

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    try {
      const count = await buildAndDownload();
      toast.success(`Downloaded ${count} assets.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.');
    }
    setDownloading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadResult(null);
    setErrorDetails(null);
    try {
      const detected = await parseFile(file);
      setSheets(detected);
    } catch (err) {
      setErrorDetails('File parse error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function toggleSheet(i: number) {
    setSheets(prev => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s));
  }

  function changeCategory(i: number, cat: string) {
    setSheets(prev => prev.map((s, idx) => idx === i
      ? { ...s, category: cat, rows: s.rows.map(r => ({ ...r, category: cat })) }
      : s
    ));
  }

  async function handleUpload() {
    const selected = sheets.filter(s => s.selected && s.rows.length > 0);
    if (selected.length === 0) { toast.error('No sheets selected.'); return; }
    const allRows = selected.flatMap(s => s.rows);
    setUploading(true);
    setErrorDetails(null);
    setUploadResult(null);
    try {
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: allRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorDetails(data.error || 'Upload failed — no error detail returned.');
      } else {
        setUploadResult(data);
        toast.success(`${data.inserted} added, ${data.updated} updated.`);
      }
    } catch (err) {
      setErrorDetails('Network error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setUploading(false);
  }

  const selectedCount = sheets.filter(s => s.selected).reduce((n, s) => n + s.rows.length, 0);

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Download ── */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-3">
            <h1 className="text-2xl font-bold">Download Inventory</h1>
            <p className="text-base-content/60 text-sm">
              Export everything in the database to an Excel file — one sheet per asset
              category (Computer, Printer, Phone, etc.), with a Site column on every sheet
              so you can compare against your original spreadsheet.
            </p>
            <button
              className="btn btn-success btn-sm w-fit"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading
                ? <span className="loading loading-spinner loading-sm" />
                : <><Download className="w-4 h-4" /> Download to Excel</>
              }
            </button>
          </div>
        </div>

        <div className="divider text-base-content/30 text-xs">UPLOAD</div>

        {/* ── Upload ── */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">
            <h2 className="text-xl font-bold">Upload Inventory</h2>
            <p className="text-base-content/60 text-sm">
              Select an Excel (.xlsx) file. IT Buddy will detect each sheet&apos;s asset type
              and let you choose which sheets to import.
            </p>

            <div
              className="border-2 border-dashed border-base-300 rounded-box p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-base-content/70">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                  <span className="font-medium">{fileName}</span>
                </div>
              ) : (
                <div className="space-y-2 text-base-content/40">
                  <Upload className="w-8 h-8 mx-auto" />
                  <p className="text-sm">Click to select an Excel file</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Sheet list */}
        {sheets.length > 0 && (
          <div className="card bg-base-100 shadow">
            <div className="card-body p-5 space-y-3">
              <h2 className="font-semibold">Detected sheets</h2>
              <div className="space-y-2">
                {sheets.map((s, i) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 p-3 rounded-box border border-base-300"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={s.selected}
                      onChange={() => toggleSheet(i)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      {s.site && <p className="text-xs text-base-content/50">{s.site}</p>}
                    </div>
                    <select
                      className="select select-bordered select-xs w-28"
                      value={s.category}
                      onChange={e => changeCategory(i, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <span className="text-xs text-base-content/50 w-16 text-right">
                      {s.rows.length} rows
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-base-content/60">{selectedCount} assets selected</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleUpload}
                  disabled={uploading || selectedCount === 0}
                >
                  {uploading
                    ? <span className="loading loading-spinner loading-sm" />
                    : <><Upload className="w-4 h-4" /> Upload</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {errorDetails && (
          <div className="card bg-base-100 border border-error shadow">
            <div className="card-body p-5 space-y-2">
              <p className="font-semibold text-error">Upload failed</p>
              <p className="text-sm text-base-content/70">{errorDetails}</p>
            </div>
          </div>
        )}

        {/* Upload result */}
        {uploadResult && (
          <div className="card bg-base-100 shadow">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 text-success font-semibold">
                <CheckCircle className="w-5 h-5" />
                Upload complete
              </div>
              <p className="text-sm text-base-content/70 mt-1">
                {uploadResult.inserted} added, {uploadResult.updated} updated.
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Column mapping ────────────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  'task #':             'task_number',
  'task number':        'task_number',
  'task name':          'task_name',
  'name':               'task_name',
  'priority':           'priority',
  'date due':           'date_due',
  'due date':           'date_due',
  'status':             'status',
  'information needed': 'information_needed',
  'info needed':        'information_needed',
  'results':            'results',
  'issues/comments':    'issues_comments',
  'issues':             'issues_comments',
  'comments':           'issues_comments',
};

interface TaskRow {
  task_number?: string;
  task_name?: string;
  priority?: string;
  date_due?: string;
  status?: string;
  information_needed?: string;
  results?: string;
  issues_comments?: string;
}

interface IssuesComment {
  timestamp: string;
  text: string;
}

interface DownloadTask {
  task_number: number | null;
  task_name: string | null;
  priority: string | null;
  date_due: string | null;
  status: string | null;
  information_needed: string | null;
  results: string | null;
  issues_comments: IssuesComment[];
}

function formatDate(val: unknown): string | null {
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

function parseFile(file: File): Promise<TaskRow[]> {
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
            const canonical = COLUMN_MAP[k.toLowerCase().trim()];
            if (canonical && v !== null && v !== undefined) {
              if (canonical === 'date_due') {
                mapped[canonical] = formatDate(v) ?? '';
              } else {
                mapped[canonical] = String(v).trim();
              }
            }
          }
          return mapped as TaskRow;
        }).filter(r => r.task_name || r.task_number);

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function serializeComments(comments: IssuesComment[]): string {
  return comments.map(c => `${c.timestamp}: ${c.text}`).join(' | ');
}

async function buildAndDownload() {
  const res = await fetch('/api/tasks');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Download failed');
  const tasks: DownloadTask[] = data.tasks;
  if (tasks.length === 0) throw new Error('No tasks in database yet.');

  const headers = ['Task #', 'Task Name', 'Priority', 'Date Due', 'Status',
                   'Information Needed', 'Results', 'Issues/Comments'];
  const rows = [
    headers,
    ...tasks.map(t => [
      t.task_number ?? '',
      t.task_name ?? '',
      t.priority ?? '',
      t.date_due ?? '',
      t.status ?? '',
      t.information_needed ?? '',
      t.results ?? '',
      serializeComments(t.issues_comments ?? []),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `IT_Buddy_Tasks_${date}.xlsx`);
  return tasks.length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskManagementPage() {
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    try {
      const count = await buildAndDownload();
      toast.success(`Downloaded ${count} tasks.`);
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
      const parsed = await parseFile(file);
      setRows(parsed);
    } catch (err) {
      setErrorDetails('File parse error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleUpload() {
    if (rows.length === 0) { toast.error('No rows to upload.'); return; }
    setUploading(true);
    setErrorDetails(null);
    setUploadResult(null);
    try {
      const res = await fetch('/api/tasks/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorDetails(data.error || 'Upload failed.');
      } else {
        setUploadResult(data);
        toast.success(`${data.inserted} tasks loaded.`);
      }
    } catch (err) {
      setErrorDetails('Network error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setUploading(false);
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Download */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-3">
            <h1 className="text-2xl font-bold">Download Tasks</h1>
            <p className="text-base-content/60 text-sm">
              Export your current task list to Excel.
            </p>
            <button
              className="btn btn-success btn-sm w-fit"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading
                ? <span className="loading loading-spinner loading-sm" />
                : <><Download className="w-4 h-4" /> Download to Excel</>}
            </button>
          </div>
        </div>

        <div className="divider text-base-content/30 text-xs">UPLOAD</div>

        {/* Upload */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-5 space-y-4">
            <h2 className="text-xl font-bold">Upload Tasks</h2>
            <p className="text-base-content/60 text-sm">
              Select an Excel (.xlsx) or CSV file. Replaces all existing tasks for your account.
            </p>

            <div
              className="border-2 border-dashed border-base-300 rounded-box p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-base-content/70">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                  <span className="font-medium">{fileName}</span>
                  {rows.length > 0 && (
                    <span className="text-xs text-base-content/40">({rows.length} rows)</span>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-base-content/40">
                  <Upload className="w-8 h-8 mx-auto" />
                  <p className="text-sm">Click to select a file</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />

            {rows.length > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading
                  ? <span className="loading loading-spinner loading-sm" />
                  : <><Upload className="w-4 h-4" /> Upload {rows.length} tasks</>}
              </button>
            )}
          </div>
        </div>

        {errorDetails && (
          <div className="card bg-base-100 border border-error shadow">
            <div className="card-body p-5">
              <p className="font-semibold text-error">Upload failed</p>
              <p className="text-sm text-base-content/70">{errorDetails}</p>
            </div>
          </div>
        )}

        {uploadResult && (
          <div className="card bg-base-100 shadow">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 text-success font-semibold">
                <CheckCircle className="w-5 h-5" />
                Upload complete
              </div>
              <p className="text-sm text-base-content/70 mt-1">
                {uploadResult.inserted} tasks loaded.
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

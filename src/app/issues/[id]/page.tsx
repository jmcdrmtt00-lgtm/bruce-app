'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import VoiceInput from '@/components/VoiceInput';
import { Incident, IncidentUpdate } from '@/types';

const STATUS_CONFIG = {
  pending:     { label: 'Queue',       className: 'badge-info'    },
  open:        { label: 'Open',        className: 'badge-error'   },
  in_progress: { label: 'In Progress', className: 'badge-warning' },
  resolved:    { label: 'Resolved',    className: 'badge-success' },
};

const PRIORITY_BADGE: Record<string, string> = {
  high:   'badge-error',
  medium: 'badge-warning',
  low:    'badge-info',
};

const UPDATE_TYPES: { value: 'approach' | 'progress' | 'resolved'; label: string; badge: string }[] = [
  { value: 'approach', label: 'My Approach', badge: 'badge-info'    },
  { value: 'progress', label: 'Progress',    badge: 'badge-warning' },
  { value: 'resolved', label: 'Resolved',    badge: 'badge-success' },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [updates, setUpdates] = useState<IncidentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateType, setUpdateType] = useState<'approach' | 'progress' | 'resolved'>('progress');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    fetch(`/api/issues/${id}`)
      .then(r => r.json())
      .then(data => {
        setIncident(data.incident);
        setUpdates(data.updates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleStatusChange(newStatus: Incident['status']) {
    await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setIncident(prev => prev ? { ...prev, status: newStatus } : prev);
  }

  async function handleAddUpdate(note: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/issues/${id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: updateType, note }),
      });
      if (!res.ok) throw new Error();
      toast.success('Update saved.');
      loadData();
    } catch {
      toast.error('Failed to save update.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!incident) {
    return (
      <main className="min-h-screen bg-base-200 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <p>Task not found.</p>
          <Link href="/" className="btn btn-ghost mt-4">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const statusCfg = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.open;

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        <Link href="/" className="btn btn-ghost btn-sm gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Task header card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge badge-lg ${statusCfg.className}`}>{statusCfg.label}</span>
              {(['pending', 'in_progress', 'resolved'] as const)
                .filter(s => s !== incident.status)
                .map(s => (
                  <button
                    key={s}
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleStatusChange(s)}
                  >
                    → {STATUS_CONFIG[s].label}
                  </button>
                ))
              }
            </div>

            <div className="flex items-start gap-2 mt-2">
              {incident.task_number && (
                <span className="text-base-content/40 text-sm mt-1 shrink-0">#{incident.task_number}</span>
              )}
              <h1 className="text-xl font-bold flex-1">
                {incident.title ?? 'Task'}
              </h1>
            </div>

            <div className="flex flex-wrap gap-2 mt-1">
              {incident.priority && (
                <span className={`badge ${PRIORITY_BADGE[incident.priority]}`}>
                  {incident.priority} priority
                </span>
              )}
              {incident.screen && (
                <Link href="/onboarding" className="badge badge-outline hover:badge-primary">
                  {incident.screen}
                </Link>
              )}
            </div>

            {incident.reported_by && (
              <p className="text-sm text-base-content/60 mt-1">Customer: {incident.reported_by}</p>
            )}
            <p className="text-xs text-base-content/40">{formatDateTime(incident.created_at)}</p>

            {incident.description && incident.description !== incident.title && (
              <>
                <div className="divider my-2" />
                <p className="text-xs font-bold uppercase text-base-content/60 mb-1">Notes</p>
                <p className="text-sm leading-relaxed">{incident.description}</p>
              </>
            )}
          </div>
        </div>

        {/* Updates timeline */}
        {updates.length > 0 && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="font-bold text-lg mb-4">Updates</h2>
              <div className="space-y-5">
                {updates.map(update => {
                  const typeCfg = UPDATE_TYPES.find(t => t.value === update.type)!;
                  return (
                    <div key={update.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge badge-sm ${typeCfg.badge}`}>{typeCfg.label}</span>
                          <span className="text-xs text-base-content/40">{formatDateTime(update.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{update.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add update — hidden once resolved */}
        {incident.status !== 'resolved' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="font-bold text-lg mb-4">Add Update</h2>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Type</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {UPDATE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`btn btn-sm ${updateType === t.value ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setUpdateType(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <VoiceInput
                onSave={handleAddUpdate}
                placeholder="Tap the mic and describe your update, or type here..."
                saveLabel={saving ? 'Saving...' : 'Save Update'}
              />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

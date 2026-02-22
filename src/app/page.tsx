'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, UserPlus, AlertCircle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { Incident } from '@/types';

const STATUS_CONFIG = {
  open:        { label: 'Open',        className: 'badge-error'   },
  in_progress: { label: 'In Progress', className: 'badge-warning' },
  resolved:    { label: 'Resolved',    className: 'badge-success' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => { setIncidents(data.incidents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const open       = incidents.filter(i => i.status === 'open').length;
  const inProgress = incidents.filter(i => i.status === 'in_progress').length;
  const resolved   = incidents.filter(i => i.status === 'resolved').length;
  const onboarding = incidents.filter(i => i.source === 'onboarding' && i.status !== 'resolved').length;
  const recent     = incidents.slice(0, 6);

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-base-content/60 mt-1">Oriol Healthcare IT</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body py-4 px-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-error" />
                <span className="text-sm font-semibold text-base-content/60">Open</span>
              </div>
              <p className="text-3xl font-bold">{loading ? '—' : open}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body py-4 px-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold text-base-content/60">In Progress</span>
              </div>
              <p className="text-3xl font-bold">{loading ? '—' : inProgress}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body py-4 px-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-sm font-semibold text-base-content/60">Resolved</span>
              </div>
              <p className="text-3xl font-bold">{loading ? '—' : resolved}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body py-4 px-5">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-base-content/60">Onboarding</span>
              </div>
              <p className="text-3xl font-bold">{loading ? '—' : onboarding}</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card bg-base-100 shadow">
          <div className="card-body py-4 px-5">
            <h2 className="font-bold text-lg mb-3">Quick Actions</h2>
            <div className="flex gap-3 flex-wrap">
              <Link href="/issues/new" className="btn btn-primary gap-2">
                <Plus className="w-4 h-4" />
                Log IT Issue
              </Link>
              <Link href="/onboarding" className="btn btn-secondary gap-2">
                <UserPlus className="w-4 h-4" />
                New Hire
              </Link>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card bg-base-100 shadow">
          <div className="card-body py-4 px-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Recent Activity</h2>
              <Link href="/issues" className="btn btn-ghost btn-sm">View all</Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">
                <p>No activity yet. Log your first issue or onboard a new hire.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map(incident => {
                  const cfg = STATUS_CONFIG[incident.status];
                  const isOnboarding = incident.source === 'onboarding';
                  return (
                    <Link
                      key={incident.id}
                      href={`/issues/${incident.id}`}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-base-200 transition-colors"
                    >
                      {isOnboarding
                        ? <UserPlus className="w-4 h-4 text-primary shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-base-content/40 shrink-0" />
                      }
                      <span className="flex-1 text-sm truncate">
                        {incident.title ?? incident.description.slice(0, 60)}
                      </span>
                      <span className={`badge badge-sm ${cfg.className} shrink-0`}>{cfg.label}</span>
                      <span className="text-xs text-base-content/40 shrink-0">{timeAgo(incident.created_at)}</span>
                      <ChevronRight className="w-3 h-3 text-base-content/30 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

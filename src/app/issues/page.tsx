'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, AlertCircle, Clock, CheckCircle2, UserPlus, Wrench } from 'lucide-react';
import { Incident } from '@/types';

const STATUS_CONFIG = {
  pending:     { label: 'Queue',       className: 'badge-info'    },
  open:        { label: 'Open',        className: 'badge-error'   },
  in_progress: { label: 'In Progress', className: 'badge-warning' },
  resolved:    { label: 'Resolved',    className: 'badge-success' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IssuesPage() {
  useEffect(() => { fetch("/api/track-click", { method: "POST" }).catch(() => {}); }, []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => { setIncidents(data.incidents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const displayed = filter === 'active'
    ? incidents.filter(i => i.status !== 'resolved')
    : incidents;

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Activity</h1>
            <p className="text-base-content/60 mt-1">Issues and onboardings in one place</p>
          </div>
          <Link href="/issues/new" className="btn btn-primary gap-2">
            <Plus className="w-4 h-4" />
            New Issue
          </Link>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-5">
          <button
            className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-success mb-3" />
              <h2 className="text-xl font-semibold">
                {filter === 'active' ? 'Nothing active right now' : 'No activity yet'}
              </h2>
              <p className="text-base-content/60">
                {filter === 'active' ? 'All caught up!' : 'Log an issue or onboard a new hire to get started.'}
              </p>
              <Link href="/issues/new" className="btn btn-primary mt-4 gap-2">
                <Plus className="w-4 h-4" /> Log Issue
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(incident => {
              const cfg = STATUS_CONFIG[incident.status];
              const isOnboarding = incident.source === 'onboarding';
              return (
                <Link
                  key={incident.id}
                  href={`/issues/${incident.id}`}
                  className="card bg-base-100 shadow hover:shadow-md transition-shadow block"
                >
                  <div className="card-body py-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {isOnboarding
                          ? <UserPlus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          : <Wrench className="w-4 h-4 text-base-content/40 mt-0.5 shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {incident.title ?? incident.description.slice(0, 80)}
                          </p>
                          {incident.reported_by && (
                            <p className="text-sm text-base-content/60 mt-0.5">
                              Reported by {incident.reported_by}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`badge ${cfg.className}`}>{cfg.label}</span>
                        <span className="text-xs text-base-content/40">{formatDate(incident.created_at)}</span>
                        <ChevronRight className="w-4 h-4 text-base-content/30" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Summary bar */}
        {incidents.length > 0 && (
          <div className="flex gap-4 mt-6 text-sm text-base-content/60">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-error" />
              {incidents.filter(i => i.status === 'open').length} open
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-warning" />
              {incidents.filter(i => i.status === 'in_progress').length} in progress
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              {incidents.filter(i => i.status === 'resolved').length} resolved
            </span>
          </div>
        )}
      </div>
    </main>
  );
}

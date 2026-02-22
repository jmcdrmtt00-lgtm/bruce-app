'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, UserPlus, Wrench } from 'lucide-react';
import { Incident } from '@/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HistoryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issue' | 'onboarding'>('all');

  useEffect(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => {
        const resolved = (data.incidents ?? []).filter((i: Incident) => i.status === 'resolved');
        setIncidents(resolved);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? incidents : incidents.filter(i => i.source === filter);

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">History</h1>
          <p className="text-base-content/60 mt-1">Resolved issues and completed onboardings</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {(['all', 'issue', 'onboarding'] as const).map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'issue' ? 'IT Issues' : 'Onboardings'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center py-16">
              <p className="text-base-content/50">Nothing resolved yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(incident => (
              <Link
                key={incident.id}
                href={`/issues/${incident.id}`}
                className="card bg-base-100 shadow hover:shadow-md transition-shadow block"
              >
                <div className="card-body py-4 px-5">
                  <div className="flex items-start gap-3">
                    {incident.source === 'onboarding'
                      ? <UserPlus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      : <Wrench className="w-4 h-4 text-base-content/40 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {incident.title ?? incident.description.slice(0, 80)}
                      </p>
                      {incident.reported_by && (
                        <p className="text-sm text-base-content/60 mt-0.5">
                          Reported by {incident.reported_by}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-base-content/40">{formatDate(incident.updated_at)}</span>
                      <ChevronRight className="w-4 h-4 text-base-content/30" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-base-content/40 mt-6">
          {filtered.length} resolved {filter === 'onboarding' ? 'onboarding' : filter === 'issue' ? 'issue' : 'item'}{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>
    </main>
  );
}

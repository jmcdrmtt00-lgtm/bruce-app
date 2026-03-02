'use client';

import { useEffect, useState } from 'react';
import { useAdminUser } from '@/libs/useAdminUser';

interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  file: string;
  stepCount: number;
}

export default function DemoScenariosPage() {
  const isAdminUser = useAdminUser();
  const [entries, setEntries] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/demo-scripts/index.json')
      .then(r => r.json())
      .then(data => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdminUser && !loading) {
    return (
      <main className="min-h-screen bg-base-200 flex items-center justify-center">
        <p className="text-base-content/40">Not available for this account.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold">Demo Scenarios</h1>
          <p className="text-base-content/60 mt-1">
            Available scripts for the IT Buddy demo. Add a new <code>.md</code> file to{' '}
            <code>public/demo-scripts/</code> and update <code>index.json</code> to add a scenario.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : entries.length === 0 ? (
          <div className="alert alert-warning">No scenarios found in index.json.</div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="card bg-base-100 shadow">
                <div className="card-body py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="font-semibold">{entry.name}</h2>
                      <p className="text-sm text-base-content/60 mt-0.5">{entry.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm text-base-content/40">{entry.stepCount} steps</span>
                      <p className="text-xs text-base-content/30 mt-0.5 font-mono">{entry.file}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

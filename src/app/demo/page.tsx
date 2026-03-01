'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo, DemoScript } from '@/contexts/DemoContext';

interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  file: string;
  stepCount: number;
}

export default function DemoPage() {
  const [entries, setEntries] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const demo = useDemo();
  const router = useRouter();

  useEffect(() => {
    fetch('/demo-scripts/index.json')
      .then(r => r.json())
      .then(data => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleStart(entry: ScriptEntry) {
    setStarting(entry.id);
    try {
      const res = await fetch(entry.file);
      const script: DemoScript = await res.json();
      demo.loadScript(script);
      const firstNav = script.steps.find(s => s.type === 'navigate');
      router.push(firstNav?.path ?? '/');
    } catch {
      setStarting(null);
    }
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold">IT Buddy Demo</h1>
          <p className="text-base-content/60 mt-1">
            Pick a script to run an automated walkthrough of IT Buddy for a prospect.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : entries.length === 0 ? (
          <div className="alert alert-warning">No demo scripts found.</div>
        ) : (
          <div className="space-y-4">
            {entries.map(entry => (
              <div key={entry.id} className="card bg-base-100 shadow">
                <div className="card-body flex-row items-center gap-4">
                  <div className="flex-1">
                    <h2 className="card-title text-lg">{entry.name}</h2>
                    <p className="text-sm text-base-content/60 mt-0.5">{entry.description}</p>
                    <p className="text-xs text-base-content/40 mt-1">{entry.stepCount} steps</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleStart(entry)}
                    disabled={!!starting}
                  >
                    {starting === entry.id
                      ? <span className="loading loading-spinner loading-sm" />
                      : '▶ Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-base-content/30 mt-10">
          Use Pause / Stop in the floating controller at any time.
        </p>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import VoiceInput from '@/components/VoiceInput';

export default function NewIssuePage() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!description.trim()) {
      toast.error('Please describe the problem first.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          reported_by: reportedBy.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      toast.success('Issue logged.');
      router.push(`/issues/${id}`);
    } catch {
      toast.error('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/issues" className="btn btn-ghost btn-sm gap-1 mb-4">
          <ChevronLeft className="w-4 h-4" />
          Back to Issues
        </Link>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="text-2xl font-bold mb-5">Log a New Issue</h1>

            <div className="form-control mb-5">
              <label className="label">
                <span className="label-text font-semibold">What&apos;s the problem?</span>
                <span className="label-text-alt text-base-content/60">Speak or type</span>
              </label>
              <VoiceInput
                onSave={text => setDescription(prev => prev ? `${prev} ${text}` : text)}
                placeholder="Tap the mic and describe the issue, or type it here..."
                saveLabel="Add to description"
              />
              {description && (
                <div className="mt-3 p-3 bg-base-200 rounded-lg">
                  <p className="text-xs font-bold uppercase text-base-content/60 mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{description}</p>
                  <button className="btn btn-ghost btn-xs mt-2" onClick={() => setDescription('')}>
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text font-semibold">Who reported this?</span>
                <span className="label-text-alt text-base-content/60">Optional</span>
              </label>
              <input
                className="input input-bordered w-full"
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>

            <div className="card-actions justify-end">
              <Link href="/issues" className="btn btn-ghost">Cancel</Link>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !description.trim()}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save Issue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

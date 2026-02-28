'use client';

import { useState, useEffect } from 'react';
import NewHireForm from '@/components/NewHireForm';
import LoginInfoSheet from '@/components/LoginInfoSheet';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { NewHire, GeneratedOutput } from '@/types';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';

interface AssetPreview {
  asset_number: string | null;
  assigned_to: string | null;
  name: string | null;
  site: string | null;
  notes: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
}

export default function OnboardingPage() {
  useEffect(() => { fetch("/api/track-click", { method: "POST" }).catch(() => {}); }, []);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approveStatus, setApproveStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle');
  const [currentAsset, setCurrentAsset] = useState<AssetPreview | null>(null);

  // If the dashboard pre-filled hire data, skip the form and go straight to output
  useEffect(() => {
    const prefill = localStorage.getItem('onboarding_prefill');
    if (prefill) {
      localStorage.removeItem('onboarding_prefill');
      try {
        const hire = JSON.parse(prefill) as NewHire;
        handleFormSubmit(hire);
      } catch { /* ignore bad data */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the current asset record from the database so we can show before/after
  useEffect(() => {
    if (!output?.hire.nextAssetNumber) { setCurrentAsset(null); return; }
    fetch(`/api/assets/preview?asset_number=${encodeURIComponent(output.hire.nextAssetNumber)}`)
      .then(r => r.json())
      .then(data => setCurrentAsset(data.asset ?? null))
      .catch(() => setCurrentAsset(null));
  }, [output?.hire.nextAssetNumber]);

  async function handleFormSubmit(hire: NewHire) {
    const loginId = `ohc.${hire.firstName[0].toLowerCase()}${hire.lastName.toLowerCase()}`;
    const role = ROLES[hire.role];
    const generated: GeneratedOutput = {
      hire,
      loginId,
      systems: role.systems,
      computerType: role.computer,
    };
    setOutput(generated);
    setApproveStatus('idle');
    setCurrentAsset(null);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generated),
      });
      if (res.ok) {
        const { id } = await res.json();
        setSessionId(id);
      }
    } catch {
      // silently continue — app works even if save fails
    }
  }

  function handleStartOver() {
    setOutput(null);
    setSessionId(null);
    setApproveStatus('idle');
    setCurrentAsset(null);
  }

  async function handleApprove() {
    if (!output) return;
    setApproveStatus('approving');
    try {
      const res = await fetch('/api/onboarding/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hire: output.hire }),
      });
      setApproveStatus(res.ok ? 'approved' : 'error');
    } catch {
      setApproveStatus('error');
    }
  }

  const assignNote = output
    ? `Assigned to ${output.hire.firstName} ${output.hire.lastName} (${ROLES[output.hire.role]?.label ?? output.hire.role}) — Start date: ${output.hire.startDate || 'TBD'}`
    : '';

  const newNotes = currentAsset?.notes
    ? `${currentAsset.notes}\n${assignNote}`
    : assignNote;

  const newSiteLabel = output ? (SITES[output.hire.site]?.label ?? output.hire.site) : '';
  // Show Site row whenever site is changing OR when we have no current record (can't tell)
  const siteChanging = !currentAsset || currentAsset.site !== newSiteLabel;

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">New Hire Onboarding</h1>
          <p className="text-base-content/60 mt-1">Oriol Healthcare — New Hire Setup</p>
        </div>

        {!output ? (
          <NewHireForm onSubmit={handleFormSubmit} />
        ) : (
          <div className="space-y-6">

            {/* ── Proposed asset change — top of page, hidden after approval ── */}
            {output.hire.nextAssetNumber && approveStatus !== 'approved' && (
              <div className={`card bg-base-100 shadow border-l-4 ${currentAsset ? 'border-warning' : 'border-error'}`}>
                <div className="card-body p-4">

                  {/* Title + orientation */}
                  {currentAsset ? (
                    <>
                      <h3 className="font-semibold text-sm">Record proposed to be updated</h3>
                      <p className="text-xs text-base-content/50 mt-0.5 mb-3">
                        record #{output.hire.nextAssetNumber}
                        {currentAsset.assigned_to && ` · ${currentAsset.assigned_to}`}
                        {currentAsset.site        && ` · ${currentAsset.site}`}
                        {currentAsset.make        && ` · ${currentAsset.make}${currentAsset.model ? ` ${currentAsset.model}` : ''}`}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold text-sm text-error">
                        Record cannot be updated — asset #{output.hire.nextAssetNumber} does not exist in the inventory database.
                      </h3>
                      <p className="text-xs text-base-content/50 mt-0.5 mb-3">
                        Please go back to the Dashboard and correct the asset number.
                      </p>
                    </>
                  )}

                  {/* Changes table */}
                  <table className="table table-xs w-full mb-3">
                    <thead>
                      <tr>
                        <th className="w-32">Field</th>
                        <th className="w-1/3">Current value in database</th>
                        <th>New value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-base-content/60">Assigned to</td>
                        <td className="text-base-content/40 italic">{currentAsset?.assigned_to ?? '—'}</td>
                        <td className="font-medium">{output.hire.firstName} {output.hire.lastName}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/60">Computer name</td>
                        <td className="text-base-content/40 italic">{currentAsset?.name ?? '—'}</td>
                        <td className="font-medium">{output.hire.computerName || '—'}</td>
                      </tr>
                      {siteChanging && (
                        <tr>
                          <td className="text-base-content/60">Site</td>
                          <td className="text-base-content/40 italic">{currentAsset?.site ?? '—'}</td>
                          <td className="font-medium">{newSiteLabel}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="text-base-content/60 align-top pt-1">Notes</td>
                        <td className="text-base-content/40 italic text-xs whitespace-pre-wrap align-top pt-1">
                          {currentAsset?.notes ?? '—'}
                        </td>
                        <td className="text-xs whitespace-pre-wrap align-top pt-1">{newNotes}</td>
                      </tr>
                    </tbody>
                  </table>

                  {approveStatus === 'error' ? (
                    <div className="alert alert-error py-2 text-sm">
                      Update failed — asset #{output.hire.nextAssetNumber} may not exist in the database.
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleApprove}
                      disabled={approveStatus === 'approving' || !currentAsset}
                    >
                      {approveStatus === 'approving' && <span className="loading loading-spinner loading-xs" />}
                      Approve update to assets table
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Login sheet + checklist ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LoginInfoSheet output={output} />
              <OnboardingChecklist output={output} sessionId={sessionId} onStartOver={handleStartOver} />
            </div>

          </div>
        )}
      </div>
    </main>
  );
}

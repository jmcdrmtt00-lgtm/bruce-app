'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  useEffect(() => { fetch("/api/track-click", { method: "POST" }).catch(() => {}); }, []);

  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approveStatus, setApproveStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle');
  const [currentAsset, setCurrentAsset] = useState<AssetPreview | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  // Load prefill from Dashboard → AI → structured data
  useEffect(() => {
    const prefill = localStorage.getItem('onboarding_prefill');
    if (prefill) {
      localStorage.removeItem('onboarding_prefill');
      try {
        const hire = JSON.parse(prefill) as NewHire;
        if (!hire.firstName) throw new Error('Missing firstName');
        if (!ROLES[hire.role]) throw new Error(`Unknown role: ${hire.role}`);
        handleFormSubmit(hire);
      } catch (e) {
        setPrefillError(e instanceof Error ? e.message : 'Could not parse hire data from AI');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch current asset record for before/after comparison
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
      // silently continue
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
  const siteChanging = !currentAsset || currentAsset.site !== newSiteLabel;

  // No prefill data — send the user back to the Dashboard
  if (!output) {
    return (
      <main className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center space-y-3">
          {prefillError ? (
            <div className="alert alert-error text-sm max-w-sm">
              <span>The AI couldn&apos;t parse the hire details. Go back to the Dashboard, fill in the onboarding task with the employee&apos;s name, role, site, and start date, then click Ask the AI again.</span>
            </div>
          ) : (
            <p className="text-base-content/60">No onboarding data — start from the Dashboard.</p>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/')}>
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const hire = output.hire;
  const roleLabel = ROLES[hire.role]?.label ?? hire.role;
  const siteLabel = SITES[hire.site]?.label ?? hire.site;

  const hireSummaryFields = [
    { label: 'Name',          value: `${hire.firstName} ${hire.lastName}`.trim() },
    { label: 'Role',          value: roleLabel },
    { label: 'Site',          value: siteLabel },
    { label: 'Start date',    value: hire.startDate || '—' },
    { label: 'Asset #',       value: hire.nextAssetNumber || '—' },
    { label: 'Computer name', value: hire.computerName || '—' },
    ...(hire.notes ? [{ label: 'Notes', value: hire.notes }] : []),
  ];

  return (
    <main className="min-h-screen bg-base-200 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Compact hire summary */}
        <div className="card bg-base-100 shadow">
          <div className="card-body p-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {hireSummaryFields.map(f => (
                <div key={f.label} className="flex gap-1.5 items-baseline">
                  <span className="text-xs text-base-content/50 whitespace-nowrap">{f.label}:</span>
                  <span className="text-sm font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Asset update card */}
        {hire.nextAssetNumber && approveStatus !== 'approved' && (
          <div className={`card bg-base-100 shadow border-l-4 ${currentAsset ? 'border-warning' : 'border-error'}`}>
            <div className="card-body p-4">
              {currentAsset ? (
                <>
                  <h3 className="font-semibold text-sm">Record proposed to be updated</h3>
                  <p className="text-xs text-base-content/50 mt-0.5 mb-3">
                    record #{hire.nextAssetNumber}
                    {currentAsset.assigned_to && ` · ${currentAsset.assigned_to}`}
                    {currentAsset.site        && ` · ${currentAsset.site}`}
                    {currentAsset.make        && ` · ${currentAsset.make}${currentAsset.model ? ` ${currentAsset.model}` : ''}`}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-sm text-error">
                    Record cannot be updated — asset #{hire.nextAssetNumber} does not exist in the inventory database.
                  </h3>
                  <p className="text-xs text-base-content/50 mt-0.5 mb-3">
                    Go back to the Dashboard and correct the asset number.
                  </p>
                </>
              )}

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
                    <td className="font-medium">{hire.firstName} {hire.lastName}</td>
                  </tr>
                  <tr>
                    <td className="text-base-content/60">Computer name</td>
                    <td className="text-base-content/40 italic">{currentAsset?.name ?? '—'}</td>
                    <td className="font-medium">{hire.computerName || '—'}</td>
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
                  Update failed — asset #{hire.nextAssetNumber} may not exist in the database.
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleApprove}
                  disabled={approveStatus === 'approving' || !currentAsset}
                  data-demo="approve"
                >
                  {approveStatus === 'approving' && <span className="loading loading-spinner loading-xs" />}
                  Approve update to assets table
                </button>
              )}
            </div>
          </div>
        )}

        {/* Checklist (left/primary) + Login sheet (right/secondary) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OnboardingChecklist output={output} sessionId={sessionId} onStartOver={handleStartOver} />
          <LoginInfoSheet output={output} />
        </div>

      </div>
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import NewHireForm from '@/components/NewHireForm';
import LoginInfoSheet from '@/components/LoginInfoSheet';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { NewHire, GeneratedOutput } from '@/types';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';

export default function OnboardingPage() {
  useEffect(() => { fetch("/api/track-click", { method: "POST" }).catch(() => {}); }, []);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approveStatus, setApproveStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle');

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LoginInfoSheet output={output} />
              <OnboardingChecklist output={output} sessionId={sessionId} onStartOver={handleStartOver} />
            </div>

            {/* Proposed database changes */}
            {output.hire.nextAssetNumber && (
              <div className="card bg-base-100 shadow">
                <div className="card-body p-4">
                  <h3 className="font-semibold text-sm mb-3">Proposed Asset Database Update</h3>
                  <table className="table table-sm w-full mb-4">
                    <thead>
                      <tr>
                        <th className="w-36">Field</th>
                        <th>Value to be set</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-base-content/60">Asset #</td>
                        <td>{output.hire.nextAssetNumber}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/60">Computer name</td>
                        <td>{output.hire.computerName}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/60">Site</td>
                        <td>{SITES[output.hire.site]?.label ?? output.hire.site}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/60">Notes</td>
                        <td>
                          Assigned to {output.hire.firstName} {output.hire.lastName} ({ROLES[output.hire.role]?.label ?? output.hire.role}) — Start date: {output.hire.startDate || 'TBD'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {approveStatus === 'approved' ? (
                    <div className="alert alert-success py-2 text-sm">Asset database updated successfully.</div>
                  ) : approveStatus === 'error' ? (
                    <div className="alert alert-error py-2 text-sm">Update failed — asset #{output.hire.nextAssetNumber} may not exist in the database.</div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleApprove}
                      disabled={approveStatus === 'approving'}
                    >
                      {approveStatus === 'approving' && <span className="loading loading-spinner loading-xs" />}
                      Approve
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

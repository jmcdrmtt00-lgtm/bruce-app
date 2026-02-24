'use client';

import { useState, useEffect } from 'react';
import NewHireForm from '@/components/NewHireForm';
import LoginInfoSheet from '@/components/LoginInfoSheet';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { NewHire, GeneratedOutput } from '@/types';
import { ROLES } from '@/data/roles';

export default function OnboardingPage() {
  useEffect(() => { fetch("/api/track-click", { method: "POST" }).catch(() => {}); }, []);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoginInfoSheet output={output} />
            <OnboardingChecklist output={output} sessionId={sessionId} onStartOver={handleStartOver} />
          </div>
        )}
      </div>
    </main>
  );
}

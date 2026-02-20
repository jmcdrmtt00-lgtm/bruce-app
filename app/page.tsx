'use client';

import { useState } from 'react';
import NewHireForm from '../components/NewHireForm';
import LoginInfoSheet from '../components/LoginInfoSheet';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { NewHire, GeneratedOutput } from '../types';
import { ROLES } from '../data/roles';

export default function Home() {
  const [output, setOutput] = useState<GeneratedOutput | null>(null);

  function handleFormSubmit(hire: NewHire) {
    const loginId = `ohc.${hire.firstName[0].toLowerCase()}${hire.lastName.toLowerCase()}`;
    const role = ROLES[hire.role];
    setOutput({
      hire,
      loginId,
      systems: role.systems,
      computerType: role.computer,
    });
  }

  function handleStartOver() {
    setOutput(null);
  }

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Bruce IT Onboarding</h1>
          <p className="text-base-content/60 mt-1">Oriol Healthcare — New Hire Setup</p>
        </div>

        {!output ? (
          <NewHireForm onSubmit={handleFormSubmit} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoginInfoSheet output={output} />
            <OnboardingChecklist output={output} onStartOver={handleStartOver} />
          </div>
        )}
      </div>
    </main>
  );
}

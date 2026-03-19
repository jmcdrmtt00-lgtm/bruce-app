'use client';

import AIDiagnosisPanel from '@/components/AIDiagnosisPanel';

const SAMPLE_DIAGNOSIS =
  'The Activities PC is most likely experiencing a failing hard drive. ' +
  'The combination of slow boot times, intermittent freezing, and the age of the machine ' +
  'are classic early-stage HDD failure symptoms.';

const SAMPLE_ACTIONS = [
  'Back up all user data from the Activities PC immediately before it worsens.',
  'Run CrystalDiskInfo (free) to check the drive health status — look for "Caution" or "Bad" sectors.',
  'If drive health is poor, order a replacement SSD (e.g. Samsung 870 EVO 500GB, ~$50).',
  'Clone the old drive to the new SSD using Macrium Reflect Free to avoid a fresh Windows install.',
  'Swap the drive, boot up, and confirm normal operation before returning to staff.',
];

export default function PreviewDiagnosisPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <p className="text-slate-500 font-mono text-xs uppercase tracking-widest mb-6">
        Preview — Gemini AI Diagnosis Panel Design
      </p>
      <AIDiagnosisPanel
        diagnosis={SAMPLE_DIAGNOSIS}
        actions={SAMPLE_ACTIONS}
        onRetry={() => alert('Refine Diagnosis clicked')}
      />
    </div>
  );
}

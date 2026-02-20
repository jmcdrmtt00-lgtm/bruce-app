'use client';

import { useState } from 'react';
import { GeneratedOutput } from '../types';
import { ROLES, SYSTEM_LABELS } from '../data/roles';
import { SITES } from '../data/sites';

interface Props {
  output: GeneratedOutput;
  onStartOver: () => void;
}

interface CheckItem {
  id: string;
  label: string;
}

export default function OnboardingChecklist({ output, onStartOver }: Props) {
  const { hire, loginId, systems, computerType } = output;
  const role = ROLES[hire.role];
  const site = SITES[hire.site];
  const fullName = `${hire.firstName} ${hire.lastName}`;
  const needsComputer = computerType !== 'none';

  const computerItems: CheckItem[] = needsComputer ? [
    { id: 'asset', label: `Tag computer — Asset #${hire.nextAssetNumber}` },
    { id: 'rename', label: `Rename computer to ${hire.computerName}` },
    { id: 'domain', label: 'Join to domain (oriolhealthcare.local)' },
    { id: 'updates', label: 'Run Windows Updates' },
    { id: 'software', label: 'Install standard software (Office, AV, etc.)' },
    ...(computerType === 'desktop+laptop' ? [{ id: 'laptop', label: 'Set up laptop as well (desktop+laptop role)' }] : []),
  ] : [];

  const accountItems: CheckItem[] = systems.map(sys => ({
    id: `acct_${sys}`,
    label: `Create ${SYSTEM_LABELS[sys]} account for ${loginId}`,
  }));

  const physicalItems: CheckItem[] = [
    { id: 'phone', label: 'Configure desk phone / RingCentral extension' },
    { id: 'desk', label: 'Set up workstation at desk' },
  ];

  const handoffItems: CheckItem[] = [
    { id: 'sheet', label: 'Print and hand login info sheet to employee' },
    { id: 'walkthrough', label: 'Walk employee through first login (domain)' },
    ...(systems.includes('m365') ? [{ id: 'email_pw', label: 'Set permanent email password with employee' }] : []),
    ...(systems.includes('pcc') ? [{ id: 'pcc_pw', label: 'Employee changes PCC temp password' }] : []),
    { id: 'done', label: 'Confirm all systems accessible — onboarding complete' },
  ];

  type CheckedState = Record<string, boolean>;
  const allItems = [...computerItems, ...accountItems, ...physicalItems, ...handoffItems];
  const [checked, setChecked] = useState<CheckedState>(
    Object.fromEntries(allItems.map(i => [i.id, false]))
  );

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const completedCount = Object.values(checked).filter(Boolean).length;
  const totalCount = allItems.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function renderSection(title: string, items: CheckItem[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">{title}</h3>
        <div className="space-y-2">
          {items.map(item => (
            <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="checkbox checkbox-primary mt-0.5"
                checked={checked[item.id] || false}
                onChange={() => toggle(item.id)}
              />
              <span className={`text-sm leading-tight ${checked[item.id] ? 'line-through text-base-content/40' : ''}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl print:hidden">
      <div className="card-body">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-title text-xl">Onboarding Checklist</h2>
          <button className="btn btn-ghost btn-sm" onClick={onStartOver}>
            Start Over
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 flex-wrap mb-2">
            <span className="badge badge-primary">{fullName}</span>
            <span className="badge badge-secondary">{role.label}</span>
            <span className="badge badge-ghost">{site.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <progress className="progress progress-primary flex-1" value={percent} max="100" />
            <span className="text-sm font-mono text-base-content/60 whitespace-nowrap">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        {needsComputer && renderSection('Computer Setup', computerItems)}
        {renderSection('Account Creation', accountItems)}
        {renderSection('Physical Setup', physicalItems)}
        {renderSection('Handoff', handoffItems)}

        {percent === 100 && (
          <div className="alert alert-success mt-2">
            <span className="font-semibold">All tasks complete! {fullName} is fully onboarded.</span>
          </div>
        )}
      </div>
    </div>
  );
}

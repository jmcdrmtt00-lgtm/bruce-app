'use client';

import { GeneratedOutput } from '../types';
import { ROLES, SYSTEM_LABELS } from '../data/roles';
import { SITES } from '../data/sites';

interface Props {
  output: GeneratedOutput;
}

interface FieldRowProps {
  label: string;
  value?: string;
  blank?: boolean;
  mono?: boolean;
}

function FieldRow({ label, value, blank, mono }: FieldRowProps) {
  return (
    <tr className="border-b border-base-300">
      <td className="py-2 pr-4 font-semibold text-sm w-40 align-top">{label}</td>
      <td className={`py-2 text-sm ${mono ? 'font-mono' : ''} ${blank ? 'text-base-content/30 italic' : ''}`}>
        {blank ? '____________________________' : value}
      </td>
    </tr>
  );
}

export default function LoginInfoSheet({ output }: Props) {
  const { hire, loginId, systems } = output;
  const fullName = `${hire.firstName} ${hire.lastName}`;
  const email = `${loginId}@oriolhealthcare.com`;
  const site = SITES[hire.site];
  const role = ROLES[hire.role];

  const hasPCC = systems.includes('pcc');
  const hasUKG = systems.includes('ukg');
  const hasRC = systems.includes('ringcentral');

  function handlePrint() {
    window.print();
  }

  return (
    <div className="card bg-base-100 shadow-xl print:shadow-none print:card-normal">
      <div className="card-body">
        <div className="flex items-center justify-between mb-2 print:hidden">
          <h2 className="card-title text-xl">Login Info Sheet</h2>
          <button className="btn btn-outline btn-sm" onClick={handlePrint}>
            Print
          </button>
        </div>

        {/* Print header — hidden on screen */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">New Employee Login Information</h1>
          <p className="text-sm text-gray-600">Oriol Healthcare</p>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="badge badge-primary">{role.label}</span>
            <span className="badge badge-ghost">{site.label}</span>
            {hire.startDate && (
              <span className="badge badge-ghost">Start: {hire.startDate}</span>
            )}
          </div>
        </div>

        {/* Employee Info */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Employee</h3>
          <table className="w-full">
            <tbody>
              <FieldRow label="Name" value={fullName} />
              <FieldRow label="Title / Role" value={role.label} />
              <FieldRow label="Location" value={site.label} />
            </tbody>
          </table>
        </section>

        {/* Active Directory / Domain */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Domain Account</h3>
          <table className="w-full">
            <tbody>
              <FieldRow label="Domain Login" value={loginId} mono />
              <FieldRow label="Temp Password" value="Password1" mono />
            </tbody>
          </table>
        </section>

        {/* Microsoft 365 / Email */}
        {systems.includes('m365') && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Microsoft 365 / Email</h3>
            <table className="w-full">
              <tbody>
                <FieldRow label="Email Address" value={email} mono />
                <FieldRow label="Email Password" blank />
              </tbody>
            </table>
          </section>
        )}

        {/* PCC */}
        {hasPCC && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">PointClickCare (PCC)</h3>
            <table className="w-full">
              <tbody>
                <FieldRow label="Username" value={loginId} mono />
                <FieldRow label="Temp Password" value="Password1" mono />
              </tbody>
            </table>
          </section>
        )}

        {/* UKG */}
        {hasUKG && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">UKG (Payroll / Scheduling)</h3>
            <table className="w-full">
              <tbody>
                <FieldRow label="Username" blank />
                <FieldRow label="Password" blank />
              </tbody>
            </table>
          </section>
        )}

        {/* RingCentral */}
        {hasRC && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">RingCentral</h3>
            <table className="w-full">
              <tbody>
                <FieldRow label="Extension" blank />
                <FieldRow label="Username" value={email} mono />
                <FieldRow label="Password" blank />
              </tbody>
            </table>
          </section>
        )}

        {hire.notes && (
          <section className="mt-2">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-1 tracking-wide">Notes</h3>
            <p className="text-sm">{hire.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}

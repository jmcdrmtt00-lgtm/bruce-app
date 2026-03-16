'use client';

import { useState } from 'react';
import { GeneratedOutput } from '@/types';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';
import { COMPANY_NAME, EMAIL_DOMAIN, TEMP_PASSWORD } from '@/data/customerConfig';
import { formatDate } from '@/lib/formatDate';

interface Props {
  output: GeneratedOutput;
}

function EditableRow({ label, value, onChange, mono }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <tr className="border-b border-base-300">
      <td className="py-1.5 pr-4 font-semibold text-sm w-40 align-middle">{label}</td>
      <td className="py-1">
        <input
          className={`input input-bordered input-sm w-full ${mono ? 'font-mono' : ''} print:border-none print:bg-transparent print:shadow-none print:px-0 print:text-sm`}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </td>
    </tr>
  );
}

export default function LoginInfoSheet({ output }: Props) {
  const { hire, loginId, systems } = output;
  const email = `${loginId}@${EMAIL_DOMAIN}`;
  const site = SITES[hire.site];
  const role = ROLES[hire.role];

  const hasPCC = systems.includes('pcc');
  const hasUKG = systems.includes('ukg');
  const hasRC  = systems.includes('ringcentral');

  // All fields are editable; pre-filled where we know the value
  const [name,          setName]          = useState(`${hire.firstName} ${hire.lastName}`);
  const [roleLabel,     setRoleLabel]     = useState(role.label);
  const [location,      setLocation]      = useState(site.label);
  const [domainLogin,   setDomainLogin]   = useState(loginId);
  const [domainPass,    setDomainPass]    = useState(TEMP_PASSWORD);
  const [emailAddr,     setEmailAddr]     = useState(email);
  const [emailPass,     setEmailPass]     = useState('');
  const [pccUser,       setPccUser]       = useState(loginId);
  const [pccPass,       setPccPass]       = useState(TEMP_PASSWORD);
  const [ukgUser,       setUkgUser]       = useState('');
  const [ukgPass,       setUkgPass]       = useState('');
  const [rcExt,         setRcExt]         = useState('');
  const [rcUser,        setRcUser]        = useState(email);
  const [rcPass,        setRcPass]        = useState('');
  const [notes,         setNotes]         = useState(hire.notes || '');

  return (
    <div className="card bg-base-100 shadow-xl print:shadow-none print:card-normal">
      <div className="card-body">
        <div className="flex items-center justify-between mb-2 print:hidden">
          <h2 className="card-title text-xl">Login Info Sheet</h2>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            Print
          </button>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">New Employee Login Information</h1>
          <p className="text-sm text-gray-600">{COMPANY_NAME}</p>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="badge badge-primary">{role.label}</span>
            <span className="badge badge-ghost">{site.label}</span>
            {hire.startDate && (
              <span className="badge badge-ghost">Start: {formatDate(hire.startDate)}</span>
            )}
          </div>
        </div>

        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Employee</h3>
          <table className="w-full">
            <tbody>
              <EditableRow label="Name"        value={name}      onChange={setName} />
              <EditableRow label="Title / Role" value={roleLabel} onChange={setRoleLabel} />
              <EditableRow label="Location"    value={location}  onChange={setLocation} />
            </tbody>
          </table>
        </section>

        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Domain Account</h3>
          <table className="w-full">
            <tbody>
              <EditableRow label="Domain Login"  value={domainLogin} onChange={setDomainLogin} mono />
              <EditableRow label="Temp Password" value={domainPass}  onChange={setDomainPass}  mono />
            </tbody>
          </table>
        </section>

        {systems.includes('m365') && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">Microsoft 365 / Email</h3>
            <table className="w-full">
              <tbody>
                <EditableRow label="Email Address"  value={emailAddr} onChange={setEmailAddr} mono />
                <EditableRow label="Email Password" value={emailPass} onChange={setEmailPass} mono />
              </tbody>
            </table>
          </section>
        )}

        {hasPCC && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">PointClickCare (PCC)</h3>
            <table className="w-full">
              <tbody>
                <EditableRow label="Username"      value={pccUser} onChange={setPccUser} mono />
                <EditableRow label="Temp Password" value={pccPass} onChange={setPccPass} mono />
              </tbody>
            </table>
          </section>
        )}

        {hasUKG && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">UKG (Payroll / Scheduling)</h3>
            <table className="w-full">
              <tbody>
                <EditableRow label="Username" value={ukgUser} onChange={setUkgUser} mono />
                <EditableRow label="Password" value={ukgPass} onChange={setUkgPass} mono />
              </tbody>
            </table>
          </section>
        )}

        {hasRC && (
          <section className="mb-4">
            <h3 className="text-sm font-bold uppercase text-base-content/60 mb-2 tracking-wide">RingCentral</h3>
            <table className="w-full">
              <tbody>
                <EditableRow label="Extension" value={rcExt}  onChange={setRcExt}  mono />
                <EditableRow label="Username"  value={rcUser} onChange={setRcUser} mono />
                <EditableRow label="Password"  value={rcPass} onChange={setRcPass} mono />
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-2">
          <h3 className="text-sm font-bold uppercase text-base-content/60 mb-1 tracking-wide">Notes</h3>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full text-sm print:border-none print:bg-transparent print:shadow-none print:px-0 print:resize-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
}

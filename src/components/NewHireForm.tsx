'use client';

import { useState, useEffect } from 'react';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';
import { NewHire } from '@/types';

interface Props {
  onSubmit: (hire: NewHire) => void;
}

function generateComputerName(site: keyof typeof SITES, role: keyof typeof ROLES, firstName: string, lastName: string): string {
  const siteCode = SITES[site].code;
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  return initials ? `${siteCode}-${initials}` : '';
}

export default function NewHireForm({ onSubmit }: Props) {
  const [form, setForm] = useState<NewHire>({
    firstName: '',
    lastName: '',
    role: 'business_office',
    site: 'holden',
    startDate: '',
    nextAssetNumber: '0313',
    computerName: '',
    notes: '',
  });

  useEffect(() => {
    if (form.firstName && form.lastName) {
      setForm(prev => ({
        ...prev,
        computerName: generateComputerName(prev.site, prev.role, prev.firstName, prev.lastName),
      }));
    }
  }, [form.firstName, form.lastName, form.site, form.role]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  const computerType = ROLES[form.role].computer;
  const needsComputer = computerType !== 'none';

  return (
    <div className="card bg-base-100 shadow-xl max-w-2xl mx-auto">
      <div className="card-body">
        <h2 className="card-title text-2xl mb-4">New Hire Information</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">First Name</span></label>
              <input
                className="input input-bordered w-full"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                placeholder="Jane"
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Last Name</span></label>
              <input
                className="input input-bordered w-full"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Role</span></label>
              <select
                className="select select-bordered w-full"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                {Object.entries(ROLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Site</span></label>
              <select
                className="select select-bordered w-full"
                name="site"
                value={form.site}
                onChange={handleChange}
              >
                {Object.entries(SITES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Start Date</span></label>
            <input
              className="input input-bordered w-full"
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              required
            />
          </div>

          {needsComputer && (
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Next Asset #</span>
                </label>
                <input
                  className="input input-bordered w-full font-mono"
                  name="nextAssetNumber"
                  value={form.nextAssetNumber}
                  onChange={handleChange}
                  placeholder="0313"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Computer Name</span>
                  <span className="label-text-alt text-base-content/60">auto-generated</span>
                </label>
                <input
                  className="input input-bordered w-full font-mono"
                  name="computerName"
                  value={form.computerName}
                  onChange={handleChange}
                  placeholder="HNH-JD"
                />
              </div>
            </div>
          )}

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Notes</span></label>
            <textarea
              className="textarea textarea-bordered w-full"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any special requirements, equipment, or instructions..."
            />
          </div>

          <div className="card-actions justify-end pt-2">
            <button type="submit" className="btn btn-primary btn-lg">
              Generate Onboarding Package
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SimulateTicketModal({ isOpen, onClose, onSubmitted }: Props) {
  const [from, setFrom]       = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!from.trim())    { toast.error('Sender email is required'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim())    { toast.error('Email body is required'); return; }

    setSubmitting(true);
    try {
      // TODO: wire to /api/email/simulate once triage backend is built
      await new Promise(r => setTimeout(r, 600)); // placeholder
      toast.success('Ticket submitted — triage coming soon!');
      setFrom(''); setSubject(''); setBody('');
      onSubmitted();
      onClose();
    } catch {
      toast.error('Failed to submit ticket.');
    }
    setSubmitting(false);
  }

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Simulate Incoming Email</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">From *</span></label>
            <input
              className="input input-bordered w-full"
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="sender@oriolhealthcare.com"
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Subject *</span></label>
            <input
              className="input input-bordered w-full"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of the issue..."
            />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Body *</span></label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={6}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Full email body..."
            />
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <span className="spinner spinner-sm" /> : 'Submit'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

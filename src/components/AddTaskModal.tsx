'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import VoiceInput from '@/components/VoiceInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddTaskModal({ isOpen, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | ''>('');
  const [customer, setCustomer] = useState('');
  const [screen, setScreen] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress'>('pending');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('Task name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       name.trim(),
          reported_by: customer.trim() || null,
          priority:    priority || null,
          screen:      screen   || null,
          status,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Task added!');
      setName(''); setPriority(''); setCustomer(''); setScreen(''); setStatus('pending');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to add task.');
    }
    setSaving(false);
  }

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Add Task</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Task Name *</span></label>
            <input
              className="input input-bordered w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Describe the task..."
              autoFocus
            />
            <div className="mt-2">
              <VoiceInput
                onSave={text => setName(text)}
                placeholder="Or speak the task name..."
                saveLabel="Use this name"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Priority</span></label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm capitalize ${priority === p ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPriority(prev => prev === p ? '' : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Customer */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Customer</span></label>
            <input
              className="input input-bordered w-full"
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="Who is this for? (optional)"
            />
          </div>

          {/* Screen */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Screen</span></label>
            <select
              className="select select-bordered w-full"
              value={screen}
              onChange={e => setScreen(e.target.value)}
            >
              <option value="">None</option>
              <option value="Onboarding">Onboarding</option>
            </select>
          </div>

          {/* Status */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Add to</span></label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn btn-sm ${status === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatus('pending')}
              >
                Queue
              </button>
              <button
                type="button"
                className={`btn btn-sm ${status === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatus('in_progress')}
              >
                In Progress
              </button>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'Add Task'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import SimulateTicketModal from '@/components/SimulateTicketModal';
import { formatDate } from '@/lib/formatDate';

interface Ticket {
  id: string;
  task_number: number;
  subject: string;
  requester: string;
  status: 'pending' | 'in_progress' | 'resolved';
  received_at: string;
}

// Placeholder data — will be replaced with real DB fetch once triage backend is built
const MOCK_TICKETS: Ticket[] = [
  {
    id: 'mock-1',
    task_number: 1,
    subject: 'Printer offline at nurses station — 2nd floor Holden',
    requester: 'Maria.Santos@oriolhealthcare.com',
    status: 'pending',
    received_at: '2026-03-13',
  },
];

const STATUS_BADGE: Record<string, string> = {
  pending:     'badge-warning',
  in_progress: 'badge-info',
  resolved:    'badge-success',
};

const STATUS_LABEL: Record<string, string> = {
  pending:     'Queue',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};

export default function TicketsPage() {
  const [showSimulate, setShowSimulate] = useState(false);

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowSimulate(true)}
        >
          + Simulate Ticket
        </button>
      </div>

      <div className="overflow-x-auto rounded-box shadow">
        <table className="table table-xs table-fixed bg-base-100 w-full">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Subject</th>
              <th className="w-52">Requester</th>
              <th className="w-28 text-center">Status</th>
              <th className="w-28 text-center">Received</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TICKETS.map(ticket => (
              <tr key={ticket.id} className="hover cursor-pointer [&>td]:py-1">
                <td className="text-base-content/40 text-xs">{ticket.task_number}</td>
                <td>
                  <p className="truncate font-medium text-sm">{ticket.subject}</p>
                </td>
                <td className="text-xs text-base-content/70 truncate">{ticket.requester}</td>
                <td className="text-center">
                  <span className={`badge badge-sm ${STATUS_BADGE[ticket.status]}`}>
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </td>
                <td className="text-center text-xs text-base-content/70">
                  {formatDate(ticket.received_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SimulateTicketModal
        isOpen={showSimulate}
        onClose={() => setShowSimulate(false)}
        onSubmitted={() => {/* will reload real tickets once backend is wired */}}
      />
    </main>
  );
}

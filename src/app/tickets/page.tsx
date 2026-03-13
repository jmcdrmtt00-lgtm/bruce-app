'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import SimulateTicketModal from '@/components/SimulateTicketModal';
import { formatDate } from '@/lib/formatDate';

// ── Mock data — replaced with real DB fetch once triage backend is built ──────

interface Ticket {
  id: string;
  task_number: number;
  subject: string;
  requester: string;
  status: 'in_progress' | 'pending_reply' | 'draft_questions';
  received_at: string;
  description?: string;
}

const MOCK_TICKETS: Ticket[] = [
  {
    id: 'mock-1',
    task_number: 1,
    subject: 'Printer offline at nurses station — 2nd floor Holden',
    requester: 'Maria.Santos@oriolhealthcare.com',
    status: 'in_progress',
    received_at: '2026-03-13',
    description: 'The printer by the nurses station on the 2nd floor has been offline since this morning. We can\'t print medication labels. Please help ASAP.',
  },
  {
    id: 'mock-2',
    task_number: 2,
    subject: 'Can\'t log into PCC',
    requester: 'Diane.Nguyen@oriolhealthcare.com',
    status: 'pending_reply',
    received_at: '2026-03-12',
    description: 'I sent follow-up questions to Diane asking which workstation she is using and whether she can log in on another computer.',
  },
  {
    id: 'mock-3',
    task_number: 3,
    subject: 'Computer running very slowly',
    requester: 'Tom.Rivera@oriolhealthcare.com',
    status: 'draft_questions',
    received_at: '2026-03-13',
    description: 'Draft: "Can you tell me which computer you are using (the asset tag is on the side or bottom)? How long has it been slow — did it start after any Windows update or new software install?"',
  },
];

// ── Mini ticket table ──────────────────────────────────────────────────────────

function TicketTable({
  tickets,
  onRowClick,
  selectedId,
}: {
  tickets: Ticket[];
  onRowClick: (t: Ticket) => void;
  selectedId: string | null;
}) {
  if (tickets.length === 0) {
    return (
      <div className="bg-base-100 rounded-box shadow p-4 text-center text-base-content/40 text-sm">
        None
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-xs table-fixed bg-base-100 w-full">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Subject</th>
            <th className="w-24">Requester</th>
            <th className="w-24 text-center">Received</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(ticket => (
            <tr
              key={ticket.id}
              className={`hover cursor-pointer [&>td]:py-1 ${selectedId === ticket.id ? 'bg-primary/10' : ''}`}
              onClick={() => onRowClick(ticket)}
            >
              <td className="text-base-content/40 text-xs">{ticket.task_number}</td>
              <td><p className="truncate font-medium text-sm">{ticket.subject}</p></td>
              <td className="text-xs text-base-content/70 truncate max-w-0">{ticket.requester.split('@')[0]}</td>
              <td className="text-center text-xs text-base-content/70">{formatDate(ticket.received_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [showSimulate, setShowSimulate] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const inProcess      = MOCK_TICKETS.filter(t => t.status === 'in_progress');
  const pendingReply   = MOCK_TICKETS.filter(t => t.status === 'pending_reply');
  const draftQuestions = MOCK_TICKETS.filter(t => t.status === 'draft_questions');

  return (
    <main className="min-h-screen bg-base-200 px-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">

        {/* Left — ticket lists */}
        <div className="space-y-6">

          {/* Tasks in process */}
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in process</h2>
            <TicketTable tickets={inProcess} onRowClick={setSelected} selectedId={selected?.id ?? null} />
          </div>

          {/* Questions sent to Requester */}
          <div>
            <h2 className="text-lg font-bold mb-2">Questions sent to Requester</h2>
            <TicketTable tickets={pendingReply} onRowClick={setSelected} selectedId={selected?.id ?? null} />
          </div>

          {/* Draft questions for Bruce to review */}
          <div>
            <h2 className="text-lg font-bold mb-2">Draft questions for Bruce to review</h2>
            <TicketTable tickets={draftQuestions} onRowClick={setSelected} selectedId={selected?.id ?? null} />
          </div>

        </div>

        {/* Right — detail panel */}
        <div className="lg:sticky lg:top-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-2">

              {/* Header row */}
              <div className="flex justify-between items-center">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowSimulate(true)}
                >
                  + Simulate Ticket Creation
                </button>
                {selected && (
                  <button className="btn btn-ghost btn-xs text-base-content/40" onClick={() => setSelected(null)}>
                    clear
                  </button>
                )}
              </div>

              {/* Empty state */}
              {!selected && (
                <p className="text-center text-base-content/40 text-sm py-4">Select a ticket to view it</p>
              )}

              {/* Ticket detail */}
              {selected && (
                <>
                  <div className="form-control">
                    <label className="label py-0">
                      <span className="label-text text-xs font-semibold">Subject</span>
                    </label>
                    <p className="text-sm font-medium">{selected.subject}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0">
                        <span className="label-text text-xs font-semibold">Requester</span>
                      </label>
                      <p className="text-sm text-base-content/70">{selected.requester}</p>
                    </div>
                    <div className="form-control">
                      <label className="label py-0">
                        <span className="label-text text-xs font-semibold">Received</span>
                      </label>
                      <p className="text-sm text-base-content/70">{formatDate(selected.received_at)}</p>
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-0">
                      <span className="label-text text-xs font-semibold">
                        {selected.status === 'draft_questions' ? 'Draft reply' : 'Description / Notes'}
                      </span>
                    </label>
                    <p className="text-sm text-base-content/80 whitespace-pre-wrap">{selected.description}</p>
                  </div>

                  {selected.status === 'draft_questions' && (
                    <div className="flex gap-2 pt-2">
                      <button className="btn btn-primary btn-sm flex-1">Send to {selected.requester.split('@')[0]}</button>
                      <button className="btn btn-outline btn-sm flex-1">Edit draft</button>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      className="btn btn-ghost btn-xs text-base-content/25 hover:text-error hover:bg-transparent"
                      title="Delete ticket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>

      </div>

      <SimulateTicketModal
        isOpen={showSimulate}
        onClose={() => setShowSimulate(false)}
        onSubmitted={() => {/* will reload real tickets once backend is wired */}}
      />
    </main>
  );
}

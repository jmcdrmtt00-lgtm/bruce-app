'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident, IncidentUpdate } from '@/types';
import { formatDate } from '@/lib/formatDate';
import { TASK_TYPES, QUICK_TASK_TYPES } from '@/data/taskRequirements';
import AiDiagnoseSection, { AutoTextarea, VoiceButton, startVoice, stopVoice, wrapVoiceResult } from '@/components/AiDiagnoseSection';

// ── Shared helpers ─────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = { high: 'badge-error', low: 'badge-success' };
const PRIORITY_LABEL: Record<string, string> = { high: 'H', low: 'L' };

function normalizeScreenToTypeId(screen: string): string {
  if (!screen) return '';
  if (TASK_TYPES[screen]) return screen;
  const lower = screen.toLowerCase().replace(/[\s-]/g, '_');
  if (TASK_TYPES[lower]) return lower;
  return '';
}

// ── Ticket table ───────────────────────────────────────────────────────────────

function TicketTable({ tickets, onRowClick, selectedId }: {
  tickets: Incident[]; onRowClick: (t: Incident) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-xs table-fixed bg-base-100 w-full">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th className="text-left">Task Name</th>
            <th className="w-24">Requester</th>
            <th className="w-36 text-center">Date</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr><td colSpan={4} className="text-center text-base-content/40 text-sm py-3">None</td></tr>
          ) : tickets.map(ticket => (
            <tr key={ticket.id}
              className={`hover cursor-pointer [&>td]:py-1 ${selectedId === ticket.id ? 'bg-primary/10' : ''}`}
              onClick={() => onRowClick(ticket)}
            >
              <td className="text-base-content/40 text-xs">{ticket.task_number}</td>
              <td><p className="truncate font-medium text-sm">{ticket.title || ticket.description.slice(0, 60)}</p></td>
              <td className="text-xs text-base-content/70 truncate max-w-0">{ticket.reported_by || ''}</td>
              <td className="text-center text-xs text-base-content/70">{formatDate(ticket.date_due)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Incident[]>([]);

  // Add Ticket modal
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [newTaskName,      setNewTaskName]      = useState('');
  const [newTaskDetails,   setNewTaskDetails]   = useState('');
  const [newTaskRequester, setNewTaskRequester] = useState('');
  const [newTaskPriority,  setNewTaskPriority]  = useState<'high' | 'low' | ''>('');
  const [newTaskType,      setNewTaskType]      = useState('');
  const [addingTicket,     setAddingTicket]     = useState(false);
  const [listeningNewName,    setListeningNewName]    = useState(false);
  const [listeningNewDetails, setListeningNewDetails] = useState(false);
  const [allUpdates,       setAllUpdates]       = useState<IncidentUpdate[]>([]);
  const [historyOpen,      setHistoryOpen]      = useState(false);

  // Panel state
  const [taskNumber,   setTaskNumber]   = useState('');
  const [taskName,     setTaskName]     = useState('');
  const [priority,     setPriority]     = useState<'high' | 'low' | ''>('');
  const [dateDue,      setDateDue]      = useState('');
  const [status,       setStatus]       = useState<'pending' | 'in_progress' | 'resolved'>('pending');
  const [requester,    setRequester]    = useState('');
  const [assignedTo,   setAssignedTo]   = useState('');
  const [selectedType, setSelectedType] = useState('general');
  const [infoRequired, setInfoRequired] = useState('');
  const [infoDone,     setInfoDone]     = useState('');
  const [issues,       setIssues]       = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Incident | null>(null);
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle');

  // AI stage (for hiding infoDone when fix/recommendation summary is shown)
  const [aiStage, setAiStage] = useState('idle');

  // AI content restored from saved ai_response updates
  const [initialDiagCause,          setInitialDiagCause]          = useState<string | null>(null);
  const [initialDiagActionsText,    setInitialDiagActionsText]    = useState<string | null>(null);
  const [initialDiagRecommendation, setInitialDiagRecommendation] = useState<string | null>(null);

  // Autosave bookkeeping
  const panelDirtyRef    = useRef(false);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedDetailsRef  = useRef('');
  const savedInfoDoneRef = useRef('');
  const savedIssuesRef   = useRef('');

  // Voice state + refs (for non-AI fields)
  const [listeningName,         setListeningName]         = useState(false);
  const [listeningDate,         setListeningDate]         = useState(false);
  const [listeningRequester,    setListeningRequester]    = useState(false);
  const [listeningInfoRequired, setListeningInfoRequired] = useState(false);
  const [listeningInfoDone,     setListeningInfoDone]     = useState(false);
  const [listeningIssues,       setListeningIssues]       = useState(false);

  const nameRecRef         = useRef<unknown>(null);
  const dateRecRef         = useRef<unknown>(null);
  const requesterRecRef    = useRef<unknown>(null);
  const infoRequiredRecRef = useRef<unknown>(null);
  const infoDoneRecRef     = useRef<unknown>(null);
  const issuesRecRef       = useRef<unknown>(null);
  const clearLastVoiceFieldRef = useRef<() => void>(() => {});
  const newNameRecRef    = useRef<unknown>(null);
  const newDetailsRecRef = useRef<unknown>(null);

  function wrap(onResult: (t: string) => void, clearFn: () => void) {
    return wrapVoiceResult(onResult, clearFn, clearLastVoiceFieldRef);
  }

  const loadTickets = useCallback(() => {
    fetch('/api/issues?source=ticket')
      .then(r => r.json())
      .then(data => setTickets(data.incidents ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Autosave main fields
  useEffect(() => {
    if (!panelDirtyRef.current || !selectedTicket) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fetch(`/api/issues/${selectedTicket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: taskName.trim() || null, priority: priority || null, screen: selectedType || null, status, date_due: dateDue || null, reported_by: requester.trim() || null, assigned_to: assignedTo || null }),
        });
        loadTickets();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('idle'); }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskName, priority, dateDue, status, selectedType, requester, assignedTo]);

  function markDirty() { panelDirtyRef.current = true; setSaveStatus('saving'); }

  async function saveUpdate(type: string, note: string, lastRef: React.MutableRefObject<string>) {
    const trimmed = note.trim();
    if (trimmed === lastRef.current || !selectedTicket) return;
    setSaveStatus('saving');
    try {
      await fetch(`/api/issues/${selectedTicket.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note: trimmed }),
      });
      lastRef.current = trimmed;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); }
  }

  function resetPanel() {
    setTaskNumber(''); setTaskName(''); setPriority(''); setDateDue('');
    setStatus('pending'); setRequester(''); setAssignedTo(''); setInfoRequired(''); setInfoDone('');
    setIssues(''); setSelectedTicket(null); setSelectedType('general');
    setAllUpdates([]); setHistoryOpen(false);
    setAiStage('idle');
    setInitialDiagCause(null); setInitialDiagActionsText(null); setInitialDiagRecommendation(null);
    panelDirtyRef.current = false;
    savedDetailsRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = '';
  }

  function loadTicket(ticket: Incident) {
    setTaskNumber(String(ticket.task_number));
    setTaskName(ticket.title || ticket.description);
    setPriority(ticket.priority || '');
    setDateDue(ticket.date_due || '');
    const s = ticket.status === 'open' ? 'pending' : ticket.status;
    setStatus(s as 'pending' | 'in_progress' | 'resolved');
    setRequester(ticket.reported_by || '');
    setAssignedTo(ticket.assigned_to || '');
    const typeId = normalizeScreenToTypeId(ticket.screen || '') || 'general';
    setSelectedType(typeId);
    setInfoRequired(TASK_TYPES[typeId] ? `Information needed: ${TASK_TYPES[typeId].fields.join(', ')}` : '');
    setInfoDone(''); setIssues('');
    setAllUpdates([]); setHistoryOpen(false);
    setAiStage('idle');
    setInitialDiagCause(null); setInitialDiagActionsText(null); setInitialDiagRecommendation(null);
    setSelectedTicket(ticket);
    panelDirtyRef.current = false;
    savedDetailsRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = '';

    fetch(`/api/issues/${ticket.id}/updates`)
      .then(r => r.json())
      .then(({ updates }: { updates: IncidentUpdate[] }) => {
        setAllUpdates(updates);
        const latest = (t: string) => updates.filter(u => u.type === t).at(-1)?.note ?? '';
        const progress = latest('progress') || ticket.description;
        setInfoDone(progress);
        savedInfoDoneRef.current = progress;
        const details = latest('details');
        if (details) { setInfoRequired(details); savedDetailsRef.current = details; }
        const issuesNote = latest('issues');
        if (issuesNote) { setIssues(issuesNote); savedIssuesRef.current = issuesNote; }

        // Restore AI-generated content from saved ai_response updates
        const aiUpdates = updates.filter(u => u.type === 'ai_response');
        let restoredCause: string | null = null;
        let restoredActions: string | null = null;
        let restoredRecommendation: string | null = null;
        for (const u of aiUpdates) {
          if (u.note.startsWith('Cause: '))          restoredCause = u.note.slice('Cause: '.length);
          if (u.note.startsWith('Fix steps: '))      restoredActions = u.note.slice('Fix steps: '.length).split(' | ').map((s, i) => `${i + 1}. ${s}`).join('\n');
          if (u.note.startsWith('Recommendation: ')) restoredRecommendation = u.note.slice('Recommendation: '.length);
        }
        setInitialDiagCause(restoredCause);
        setInitialDiagActionsText(restoredActions);
        setInitialDiagRecommendation(restoredRecommendation);
      })
      .catch(() => {
        setInfoDone(ticket.description);
        savedInfoDoneRef.current = ticket.description;
      });
  }

  async function handleAddTicket() {
    if (!newTaskName.trim()) return;
    setAddingTicket(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskName.trim(),
          description: newTaskDetails.trim() || newTaskName.trim(),
          reported_by: newTaskRequester.trim() || null,
          priority: newTaskPriority || null,
          status: 'pending',
          source: 'ticket',
          screen: 'problem_to_fix',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (newTaskDetails.trim()) {
          await fetch(`/api/issues/${data.incident.id}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'details', note: newTaskDetails.trim() }),
          });
        }
        loadTickets();
        setShowAddModal(false);
        setNewTaskName(''); setNewTaskDetails('');
        setNewTaskRequester(''); setNewTaskPriority(''); setNewTaskType('');
        toast.success('Ticket added');
      } else {
        toast.error('Could not create ticket');
      }
    } catch { toast.error('Could not create ticket'); }
    setAddingTicket(false);
  }

  async function handleDelete() {
    if (!selectedTicket) return;
    if (!confirm('Delete this ticket?')) return;
    try {
      await fetch(`/api/issues/${selectedTicket.id}`, { method: 'DELETE' });
      resetPanel();
      loadTickets();
      toast.success('Ticket deleted');
    } catch { toast.error('Could not delete ticket'); }
  }

  function parseSpokenDate(text: string): string {
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const withYear = new Date(`${text} ${new Date().getFullYear()}`);
    if (!isNaN(withYear.getTime())) return withYear.toISOString().split('T')[0];
    toast.error(`Couldn't parse "${text}" as a date`); return '';
  }

  function selectProblemType(id: string) {
    setSelectedType(id);
    const pt = TASK_TYPES[id];
    if (pt) setInfoRequired(`Information needed: ${pt.fields.join(', ')}`);
    markDirty();
  }

  const inProgress = useMemo(() =>
    tickets.filter(t => t.status === 'in_progress')
      .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1)),
  [tickets]);

  const inQueue = useMemo(() =>
    tickets.filter(t => t.status === 'pending' || t.status === 'open')
      .sort((a, b) => a.task_number - b.task_number),
  [tickets]);

  const hideInfoDone = aiStage === 'fix' || aiStage === 'recommendation';

  return (
    <main className="min-h-screen bg-base-200 px-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">

        {/* Left — ticket lists */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in process</h2>
            <TicketTable tickets={inProgress} onRowClick={loadTicket} selectedId={selectedTicket?.id ?? null} />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in the queue</h2>
            <TicketTable tickets={inQueue} onRowClick={loadTicket} selectedId={selectedTicket?.id ?? null} />
          </div>
        </div>

        {/* Right — panel */}
        <div className="lg:sticky lg:top-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-2">

              <div className="flex justify-between items-center">
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                  + Add Ticket
                </button>
                {selectedTicket && (
                  <button className="btn btn-ghost btn-xs text-base-content/40" onClick={resetPanel}>clear</button>
                )}
              </div>

              <>

              {/* Task Name */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Task Name</span>
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="input input-bordered input-sm w-12 text-center px-1"
                    placeholder="#"
                    value={taskNumber}
                    onChange={e => setTaskNumber(e.target.value)}
                  />
                  <input
                    className="input input-bordered input-sm flex-1"
                    value={taskName}
                    onChange={e => { setTaskName(e.target.value); markDirty(); }}
                  />
                  <VoiceButton
                    listening={listeningName}
                    onToggle={() => listeningName
                      ? stopVoice(nameRecRef as React.MutableRefObject<unknown>, setListeningName)
                      : startVoice(wrap(t => setTaskName(prev => prev ? `${prev} ${t}` : t), () => setTaskName('')), setListeningName, nameRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>

              {/* Priority + Status + Target Date */}
              <div className="grid grid-cols-3 gap-3">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Urgency</span></label>
                  <select className="select select-bordered select-sm text-sm w-full" value={priority}
                    onChange={e => { setPriority(e.target.value as 'high' | 'low' | ''); markDirty(); }}>
                    <option value="">—</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Status</span></label>
                  <select className="select select-bordered select-sm text-sm w-full" value={status}
                    onChange={e => { setStatus(e.target.value as 'pending' | 'in_progress' | 'resolved'); markDirty(); }}>
                    <option value="pending">Queue</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Complete</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Target Date</span></label>
                  <div className="flex gap-1">
                    <input type="date" className="input input-bordered input-sm flex-1 min-w-0" value={dateDue}
                      onChange={e => { setDateDue(e.target.value); markDirty(); }} />
                    <VoiceButton
                      listening={listeningDate}
                      onToggle={() => listeningDate
                        ? stopVoice(dateRecRef as React.MutableRefObject<unknown>, setListeningDate)
                        : startVoice(wrap(t => { const d = parseSpokenDate(t); if (d) setDateDue(d); }, () => setDateDue('')), setListeningDate, dateRecRef as React.MutableRefObject<unknown>, false)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Requester + Assigned to + Task type */}
              <div className="grid grid-cols-3 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Requester</span></label>
                  <div className="flex gap-1">
                    <input className="input input-bordered input-sm flex-1 min-w-0" value={requester}
                      onChange={e => { setRequester(e.target.value); markDirty(); }} />
                    <VoiceButton
                      listening={listeningRequester}
                      onToggle={() => listeningRequester
                        ? stopVoice(requesterRecRef as React.MutableRefObject<unknown>, setListeningRequester)
                        : startVoice(wrap(t => setRequester(prev => prev ? `${prev} ${t}` : t), () => setRequester('')), setListeningRequester, requesterRecRef as React.MutableRefObject<unknown>, true)
                      }
                    />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Assigned to</span></label>
                  <select className="select select-bordered select-sm text-sm w-full" value={assignedTo}
                    onChange={e => { setAssignedTo(e.target.value); markDirty(); }}>
                    <option value="">Unassigned</option>
                    <option value="Bruce">Bruce</option>
                    <option value="John">John</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Task type</span></label>
                  <select className="select select-bordered select-sm text-sm w-full" value={selectedType}
                    onChange={e => selectProblemType(e.target.value)}>
                    {QUICK_TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* infoDone — hidden when AI fix/recommendation summary is shown */}
              <div className={`form-control${hideInfoDone ? ' hidden' : ''}`}>
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">
                    Problem to fix
                  </span>
                </label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={infoDone}
                    onChange={e => setInfoDone(e.target.value)}
                    onBlur={() => saveUpdate('progress', infoDone, savedInfoDoneRef)}
                    placeholder="What information was gathered or what actions were taken..."
                  />
                  <VoiceButton
                    listening={listeningInfoDone}
                    onToggle={() => listeningInfoDone
                      ? stopVoice(infoDoneRecRef as React.MutableRefObject<unknown>, setListeningInfoDone)
                      : startVoice(wrap(t => setInfoDone(prev => prev ? `${prev} ${t}` : t), () => setInfoDone('')), setListeningInfoDone, infoDoneRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>

              {/* AI Diagnose Section */}
              <AiDiagnoseSection
                key={selectedTicket?.id}
                selectedType={selectedType}
                infoDone={infoDone}
                setInfoDone={setInfoDone}
                infoRequired={infoRequired}
                onSaveUpdate={async (type, note) => {
                  if (!selectedTicket) return;
                  await fetch(`/api/issues/${selectedTicket.id}/updates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, note }),
                  });
                }}
                onStageChange={setAiStage}
                initialCause={initialDiagCause}
                initialActionsText={initialDiagActionsText}
                initialRecommendation={initialDiagRecommendation}
              />

              {/* Issues / Comments */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Issues / Comments</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={issues} onChange={e => setIssues(e.target.value)}
                    onBlur={() => saveUpdate('issues', issues.trim() ? `Issues/Comments: ${issues.trim()}` : '', savedIssuesRef)}
                    placeholder="Any issues or comments..."
                  />
                  <VoiceButton
                    listening={listeningIssues}
                    onToggle={() => listeningIssues
                      ? stopVoice(issuesRecRef as React.MutableRefObject<unknown>, setListeningIssues)
                      : startVoice(wrap(t => setIssues(prev => prev ? `${prev} ${t}` : t), () => setIssues('')), setListeningIssues, issuesRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>

              {/* Update history */}
              {allUpdates.length > 0 && (
                <div>
                  <button className="text-xs text-primary underline" onClick={() => setHistoryOpen(o => !o)}>
                    {historyOpen ? 'Hide history' : `View history (${allUpdates.length} entries)`}
                  </button>
                  {historyOpen && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border border-base-200 rounded-box p-2">
                      {allUpdates.map((u, i) => (
                        <div key={i} className="text-xs border-b border-base-200 last:border-0 pb-1 last:pb-0">
                          <span className="font-semibold text-base-content/50 mr-1">
                            {u.type === 'details' ? 'Task details' : u.type === 'progress' ? 'Info sent to AI' : u.type === 'ai_response' ? 'IT Buddy' : u.type === 'user_reply' ? 'Reply' : u.type}
                          </span>
                          <span className="text-base-content/30">{u.created_at ? new Date(u.created_at).toLocaleString() : ''}</span>
                          <p className="text-base-content/70 whitespace-pre-wrap mt-0.5">{u.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Delete */}
              {selectedTicket && (
                <div className="flex justify-end">
                  <button className="btn btn-ghost btn-xs text-base-content/25 hover:text-error hover:bg-transparent" title="Delete ticket" onClick={handleDelete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              </>

              {/* Autosave status */}
              <div className="h-4 text-right">
                {saveStatus === 'saving' && <span className="text-xs text-base-content/40">Saving…</span>}
                {saveStatus === 'saved'  && <span className="text-xs text-success">Saved ✓</span>}
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Add Ticket modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold mb-3">Add ticket</h3>
            <div className="space-y-2 mb-3">
              <div className="flex gap-1 items-center">
                <input className="input input-bordered input-sm flex-1" placeholder="Task name *"
                  value={newTaskName} onChange={e => setNewTaskName(e.target.value)} autoFocus />
                <VoiceButton
                  listening={listeningNewName}
                  onToggle={() => listeningNewName
                    ? stopVoice(newNameRecRef, setListeningNewName)
                    : startVoice(t => setNewTaskName(prev => prev ? `${prev} ${t}` : t), setListeningNewName, newNameRecRef, false)
                  }
                />
              </div>
              <div className="flex gap-1 items-start">
                <AutoTextarea className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                  value={newTaskDetails} onChange={e => setNewTaskDetails(e.target.value)}
                  placeholder="Task details (or paste email body) *" />
                <VoiceButton
                  listening={listeningNewDetails}
                  onToggle={() => listeningNewDetails
                    ? stopVoice(newDetailsRecRef, setListeningNewDetails)
                    : startVoice(t => setNewTaskDetails(prev => prev ? `${prev} ${t}` : t), setListeningNewDetails, newDetailsRecRef, true)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input input-bordered input-sm w-full" placeholder="Requester"
                  value={newTaskRequester} onChange={e => setNewTaskRequester(e.target.value)} />
                <select className="select select-bordered select-sm w-full" value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as 'high' | 'low' | '')}>
                  <option value="">Urgency —</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="modal-action mt-0">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddModal(false); setNewTaskName(''); setNewTaskDetails(''); setNewTaskRequester(''); setNewTaskPriority(''); setNewTaskType(''); }}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleAddTicket} disabled={addingTicket || !newTaskName.trim() || !newTaskDetails.trim()}>
                {addingTicket && <span className="spinner spinner-sm" />}
                Add Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

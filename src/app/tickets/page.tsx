'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import SimulateTicketModal from '@/components/SimulateTicketModal';
import { formatDate } from '@/lib/formatDate';
import { TASK_TYPES, QUICK_TASK_TYPES } from '@/data/taskRequirements';

// ── Mock data — replaced with real DB fetch once triage backend is built ──────
// Task numbers are in the same sequence as regular tasks (no conflicts).

interface Ticket {
  id: string;
  task_number: number;
  subject: string;
  requester: string;
  ticketStatus: 'in_progress' | 'pending_reply' | 'draft_questions';
  received_at: string;
  emailBody: string;
  priority?: 'high' | 'low';
  date_due?: string;
}

const MOCK_TICKETS: Ticket[] = [
  {
    id: 'mock-47',
    task_number: 47,
    subject: 'Printer offline at nurses station — 2nd floor Holden',
    requester: 'Maria.Santos@oriolhealthcare.com',
    ticketStatus: 'in_progress',
    received_at: '2026-03-13',
    emailBody: 'The printer by the nurses station on the 2nd floor has been offline since this morning. We can\'t print medication labels. Please help ASAP.',
    priority: 'high',
  },
  {
    id: 'mock-48',
    task_number: 48,
    subject: 'Can\'t log into PCC',
    requester: 'Diane.Nguyen@oriolhealthcare.com',
    ticketStatus: 'pending_reply',
    received_at: '2026-03-12',
    emailBody: 'Hi Bruce, I am getting an error when I try to log into PCC on my computer. It just says "invalid credentials" but I know my password is right.',
  },
  {
    id: 'mock-49',
    task_number: 49,
    subject: 'Computer running very slowly',
    requester: 'Tom.Rivera@oriolhealthcare.com',
    ticketStatus: 'draft_questions',
    received_at: '2026-03-13',
    emailBody: 'My computer has been running very slowly for the past few days. Everything takes forever to load.',
  },
];

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

function AutoTextarea({ value, onChange, onBlur, placeholder, className }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void; placeholder?: string; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} onChange={onChange} onBlur={onBlur}
      placeholder={placeholder} className={className}
      style={{ resize: 'none', overflow: 'hidden', minHeight: '2.25rem' }} />
  );
}

function VoiceButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      className={`btn btn-xs text-[7px] whitespace-nowrap shrink-0 ${listening ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' : 'bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300'}`}
      onClick={onToggle}
    >
      {listening ? 'listening' : 'not listening'}
    </button>
  );
}

// ── Ticket table ───────────────────────────────────────────────────────────────

function TicketTable({ tickets, onRowClick, selectedId, showHeader = true }: {
  tickets: Ticket[]; onRowClick: (t: Ticket) => void;
  selectedId: string | null; showHeader?: boolean;
}) {
  if (tickets.length === 0) {
    return <div className="bg-base-100 rounded-box shadow p-4 text-center text-base-content/40 text-sm">None</div>;
  }
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-xs table-fixed bg-base-100 w-full">
        {showHeader && (
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Subject</th>
              <th className="w-24">Requester</th>
              <th className="w-24 text-center">Received</th>
            </tr>
          </thead>
        )}
        <tbody>
          {tickets.map(ticket => (
            <tr key={ticket.id}
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

  // Panel state — mirrors Dashboard exactly
  const [taskNumber,   setTaskNumber]  = useState('');
  const [taskName,     setTaskName]    = useState('');
  const [priority,     setPriority]    = useState<'high' | 'low' | ''>('');
  const [dateDue,      setDateDue]     = useState('');
  const [status,       setStatus]      = useState<'pending' | 'in_progress' | 'resolved'>('pending');
  const [requester,    setRequester]   = useState('');
  const [selectedType, setSelectedType] = useState('general');
  const [infoRequired, setInfoRequired] = useState('');
  const [infoDone,     setInfoDone]    = useState('');
  const [issues,       setIssues]      = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [saveStatus,   setSaveStatus]  = useState<'idle' | 'saving' | 'saved'>('idle');

  // AI state
  const [diagnosing,       setDiagnosing]       = useState(false);
  const [diagStage,        setDiagStage]        = useState<'idle' | 'questions' | 'cause' | 'fix'>('idle');
  const [diagCause,        setDiagCause]        = useState<string | null>(null);
  const [diagDetail,       setDiagDetail]       = useState<string | null>(null);
  const [diagDetailOpen,   setDiagDetailOpen]   = useState(false);
  const [diagQuestions,    setDiagQuestions]    = useState<string[] | null>(null);
  const [diagSteps,        setDiagSteps]        = useState<string[] | null>(null);
  const [diagConversation, setDiagConversation] = useState<Record<string, unknown>[]>([]);
  const [diagAnswer,       setDiagAnswer]       = useState('');

  // Autosave bookkeeping
  const panelDirtyRef    = useRef(false);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedDetailsRef  = useRef('');
  const savedInfoDoneRef = useRef('');
  const savedIssuesRef   = useRef('');

  // Voice state + refs
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

  // Autosave — stubs until real ticket backend is wired
  useEffect(() => {
    if (!panelDirtyRef.current || !selectedTicket) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // TODO: PATCH /api/issues/${selectedTicket.id} once tickets are in the DB
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskName, priority, dateDue, status, selectedType, requester]);

  function markDirty() { panelDirtyRef.current = true; setSaveStatus('saving'); }

  async function saveUpdate(type: string, note: string, lastRef: React.MutableRefObject<string>) {
    const trimmed = note.trim();
    if (trimmed === lastRef.current || !selectedTicket) return;
    // TODO: POST /api/issues/${selectedTicket.id}/updates once tickets are in the DB
    lastRef.current = trimmed;
  }

  function resetPanel() {
    setTaskNumber(''); setTaskName(''); setPriority(''); setDateDue('');
    setStatus('pending'); setRequester(''); setInfoRequired(''); setInfoDone('');
    setIssues(''); setSelectedTicket(null); setSelectedType('general');
    setDiagStage('idle'); setDiagCause(null); setDiagDetail(null);
    setDiagDetailOpen(false); setDiagQuestions(null); setDiagSteps(null);
    setDiagConversation([]); setDiagAnswer('');
    panelDirtyRef.current = false;
    savedDetailsRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = '';
  }

  function loadTicket(ticket: Ticket) {
    setTaskNumber(String(ticket.task_number));
    setTaskName(ticket.subject);
    setPriority(ticket.priority || '');
    setDateDue(ticket.date_due || '');
    setStatus(ticket.ticketStatus === 'in_progress' ? 'in_progress' : 'pending');
    setRequester(ticket.requester);
    // Email body → "Information to send to the AI"
    setInfoDone(ticket.emailBody);
    savedInfoDoneRef.current = ticket.emailBody;
    setInfoRequired('');
    setIssues('');
    setSelectedType('general');
    setDiagStage('idle'); setDiagCause(null); setDiagDetail(null);
    setDiagDetailOpen(false); setDiagQuestions(null); setDiagSteps(null);
    setDiagConversation([]); setDiagAnswer('');
    setSelectedTicket(ticket);
    panelDirtyRef.current = false;
    savedDetailsRef.current = ''; savedIssuesRef.current = '';
  }

  // Voice helpers
  function startVoice(onResult: (text: string) => void, setActive: (v: boolean) => void, ref: React.MutableRefObject<unknown>, continuous = false) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input requires Chrome.'); return; }
    const r = new SR();
    r.continuous = continuous; r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      onResult(e.results[e.resultIndex][0].transcript);
    };
    r.onerror = (e: { error: string }) => {
      setActive(false);
      if (e.error === 'not-allowed') toast.error('Microphone access was denied.');
      else if (e.error !== 'no-speech') toast.error(`Voice error: ${e.error}`);
    };
    r.onend = () => setActive(false);
    try { r.start(); ref.current = r; setActive(true); }
    catch (err) { toast.error(`Could not start voice: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function stopVoice(ref: React.MutableRefObject<unknown>, setActive: (v: boolean) => void) {
    (ref.current as { stop: () => void } | null)?.stop(); setActive(false);
  }

  function wrapVoiceResult(onResult: (text: string) => void, clearFn: () => void) {
    return (text: string) => {
      const lower = text.toLowerCase().trim();
      if (lower.startsWith('hey buddy')) {
        const cmd = text.slice('hey buddy'.length).trim().toLowerCase();
        if (cmd.includes('clear') || cmd.includes('remove') || cmd.includes('erase')) {
          clearLastVoiceFieldRef.current(); toast('Field cleared');
        }
      } else {
        onResult(text); clearLastVoiceFieldRef.current = clearFn;
      }
    };
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

  async function handleDiagnose() {
    if (!selectedType) return;
    setDiagnosing(true); setDiagStage('idle'); setDiagCause(null); setDiagDetail(null);
    setDiagDetailOpen(false); setDiagQuestions(null); setDiagSteps(null);
    setDiagConversation([]); setDiagAnswer('');
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'symptoms', task_details: infoRequired || null, information: infoDone || null }),
      });
      const data = await res.json();
      const symptoms = [infoRequired, infoDone].filter(Boolean).join('\n') || 'No symptoms provided.';
      const userTurn = { role: 'user' as const, content: `Symptoms: ${symptoms}` };
      const toolTurns = data._tool_context ? [
        { role: 'tool_use' as const, tool_use_id: data._tool_context.tool_call.tool_use_id, name: data._tool_context.tool_call.name, input: data._tool_context.tool_call.input },
        { role: 'tool_result' as const, tool_use_id: data._tool_context.tool_call.tool_use_id, content: data._tool_context.tool_result },
      ] : [];
      if (data.cause) {
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: data.cause }]);
        setDiagCause(data.cause); setDiagDetail(data.detail ?? null); setDiagStage('cause');
      } else if (data.questions?.length) {
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: data.questions.join('\n') }]);
        setDiagQuestions(data.questions); setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
      }
    } catch { toast.error('Could not get AI response — try again.'); }
    setDiagnosing(false);
  }

  async function handleFollowUp() {
    if (!diagAnswer.trim() || !selectedType) return;
    const answer = diagAnswer.trim(); setDiagAnswer('');
    const userTurn = { role: 'user' as const, content: answer };
    const updatedConv = [...diagConversation, userTurn];
    setDiagConversation(updatedConv); setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'followup', conversation: updatedConv }),
      });
      const data = await res.json();
      if (data.cause) {
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: data.cause }]);
        setDiagCause(data.cause); setDiagDetail(data.detail ?? null); setDiagStage('cause');
      } else if (data.questions?.length) {
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: (data.questions as string[]).join('\n') }]);
        setDiagQuestions(data.questions); setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
      }
    } catch { toast.error('Could not get AI response — try again.'); }
    setDiagnosing(false);
  }

  async function handleConfirmCause() {
    if (!diagCause || !selectedType) return;
    setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'fix', information: diagCause }),
      });
      const data = await res.json();
      setDiagSteps(data.steps ?? []); setDiagStage('fix');
    } catch { toast.error('Could not get fix steps — try again.'); }
    setDiagnosing(false);
  }

  const inProcess      = useMemo(() => MOCK_TICKETS.filter(t => t.ticketStatus === 'in_progress'), []);
  const pendingReply   = useMemo(() => MOCK_TICKETS.filter(t => t.ticketStatus === 'pending_reply'), []);
  const draftQuestions = useMemo(() => MOCK_TICKETS.filter(t => t.ticketStatus === 'draft_questions'), []);

  return (
    <main className="min-h-screen bg-base-200 px-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">

        {/* Left — ticket lists */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in process</h2>
            <TicketTable tickets={inProcess} onRowClick={loadTicket} selectedId={selectedTicket?.id ?? null} />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2">Questions sent to Requester</h2>
            <TicketTable tickets={pendingReply} onRowClick={loadTicket} selectedId={selectedTicket?.id ?? null} showHeader={false} />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2">Draft questions for Bruce to review</h2>
            <TicketTable tickets={draftQuestions} onRowClick={loadTicket} selectedId={selectedTicket?.id ?? null} showHeader={false} />
          </div>
        </div>

        {/* Right — panel (mirrors Dashboard exactly) */}
        <div className="lg:sticky lg:top-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-2">

              <div className="flex justify-between items-center">
                <button className="btn btn-primary btn-sm" onClick={() => setShowSimulate(true)}>
                  + Simulate Ticket Creation
                </button>
                {selectedTicket && (
                  <button className="btn btn-ghost btn-xs text-base-content/40" onClick={resetPanel}>clear</button>
                )}
              </div>

              {!selectedTicket && (
                <p className="text-center text-base-content/40 text-sm py-4">Select a ticket to edit it</p>
              )}

              {selectedTicket && (<>

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
                      : startVoice(
                          wrapVoiceResult(t => setTaskName(prev => prev ? `${prev} ${t}` : t), () => setTaskName('')),
                          setListeningName, nameRecRef as React.MutableRefObject<unknown>, true
                        )
                    }
                  />
                </div>
              </div>

              {/* Priority + Status + Target Date */}
              <div className="grid grid-cols-3 gap-3">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Priority</span></label>
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
                        : startVoice(
                            wrapVoiceResult(t => { const d = parseSpokenDate(t); if (d) setDateDue(d); }, () => setDateDue('')),
                            setListeningDate, dateRecRef as React.MutableRefObject<unknown>, false
                          )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Requester + Task type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Requester</span></label>
                  <div className="flex gap-1">
                    <input className="input input-bordered input-sm flex-1 min-w-0" value={requester}
                      onChange={e => { setRequester(e.target.value); markDirty(); }} />
                    <VoiceButton
                      listening={listeningRequester}
                      onToggle={() => listeningRequester
                        ? stopVoice(requesterRecRef as React.MutableRefObject<unknown>, setListeningRequester)
                        : startVoice(
                            wrapVoiceResult(t => setRequester(prev => prev ? `${prev} ${t}` : t), () => setRequester('')),
                            setListeningRequester, requesterRecRef as React.MutableRefObject<unknown>, true
                          )
                      }
                    />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">Task type</span></label>
                  <select className="select select-bordered select-sm text-sm w-full" value={selectedType}
                    onChange={e => selectProblemType(e.target.value)}>
                    {QUICK_TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Task details */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Task details</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={infoRequired}
                    onChange={e => setInfoRequired(e.target.value)}
                    onBlur={() => saveUpdate('details', infoRequired, savedDetailsRef)}
                    placeholder="What information is needed or what does the checklist say..."
                  />
                  <VoiceButton
                    listening={listeningInfoRequired}
                    onToggle={() => listeningInfoRequired
                      ? stopVoice(infoRequiredRecRef as React.MutableRefObject<unknown>, setListeningInfoRequired)
                      : startVoice(
                          wrapVoiceResult(t => setInfoRequired(prev => prev ? `${prev} ${t}` : t), () => setInfoRequired('')),
                          setListeningInfoRequired, infoRequiredRecRef as React.MutableRefObject<unknown>, true
                        )
                    }
                  />
                </div>
              </div>

              {/* Information to send to the AI (pre-filled from email body) */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Information to send to the AI</span></label>
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
                      : startVoice(
                          wrapVoiceResult(t => setInfoDone(prev => prev ? `${prev} ${t}` : t), () => setInfoDone('')),
                          setListeningInfoDone, infoDoneRecRef as React.MutableRefObject<unknown>, true
                        )
                    }
                  />
                </div>
                <div className="mt-2">
                  <button className="btn btn-primary btn-sm w-full" onClick={handleDiagnose} disabled={diagnosing}>
                    {diagnosing && <span className="loading loading-spinner loading-xs" />}
                    {diagnosing ? 'Thinking…' : 'Ask the AI'}
                  </button>
                </div>
              </div>

              {/* IT Buddy response panel */}
              {diagStage !== 'idle' && (
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs font-semibold">IT Buddy</span></label>

                  {diagStage === 'questions' && diagQuestions && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-xs font-semibold text-base-content/50">To narrow down the cause, please answer:</p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {diagQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ol>
                      <AutoTextarea
                        className="textarea textarea-bordered textarea-sm w-full text-sm font-mono"
                        value={diagAnswer} onChange={e => setDiagAnswer(e.target.value)}
                        placeholder={diagQuestions.map((_, i) => `${i + 1}. `).join('\n')}
                      />
                      <button className="btn btn-outline btn-sm w-full" onClick={handleFollowUp} disabled={diagnosing || !diagAnswer.trim()}>
                        {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
                      </button>
                    </div>
                  )}

                  {diagStage === 'cause' && diagCause && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-sm font-medium">{diagCause}</p>
                      <div>
                        <button className="text-xs text-primary underline" onClick={() => setDiagDetailOpen(o => !o)}>
                          {diagDetailOpen ? 'Hide detail' : 'More detail →'}
                        </button>
                        {diagDetailOpen && <p className="text-xs text-base-content/70 mt-1">{diagDetail ?? 'No additional detail available.'}</p>}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button className="btn btn-primary btn-sm flex-1" onClick={handleConfirmCause} disabled={diagnosing}>
                          {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Steps to fix'}
                        </button>
                        <button className="btn btn-outline btn-sm flex-1" disabled={diagnosing}
                          onClick={() => { setDiagStage('questions'); setDiagQuestions(["What else can you tell me about the problem?"]); setDiagAnswer('1. '); setDiagCause(null); setDiagDetail(null); }}>
                          Not quite right
                        </button>
                      </div>
                    </div>
                  )}

                  {diagStage === 'fix' && diagSteps && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-xs font-semibold text-base-content/50">Try these steps in order:</p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {diagSteps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Issues / Comments — always at the bottom */}
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Issues / Comments</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={issues} onChange={e => setIssues(e.target.value)}
                    onBlur={() => saveUpdate('progress', issues.trim() ? `Issues/Comments: ${issues.trim()}` : '', savedIssuesRef)}
                    placeholder="Any issues or comments..."
                  />
                  <VoiceButton
                    listening={listeningIssues}
                    onToggle={() => listeningIssues
                      ? stopVoice(issuesRecRef as React.MutableRefObject<unknown>, setListeningIssues)
                      : startVoice(
                          wrapVoiceResult(t => setIssues(prev => prev ? `${prev} ${t}` : t), () => setIssues('')),
                          setListeningIssues, issuesRecRef as React.MutableRefObject<unknown>, true
                        )
                    }
                  />
                </div>
              </div>

              {/* Delete */}
              <div className="flex justify-end">
                <button className="btn btn-ghost btn-xs text-base-content/25 hover:text-error hover:bg-transparent" title="Delete ticket">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              </>)}

              {/* Autosave status */}
              <div className="h-4 text-right">
                {saveStatus === 'saving' && <span className="text-xs text-base-content/40">Saving…</span>}
                {saveStatus === 'saved'  && <span className="text-xs text-success">Saved ✓</span>}
              </div>

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

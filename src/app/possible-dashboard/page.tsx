'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident } from '@/types';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';

const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-error',
  low:  'badge-success',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'H', low: 'L',
};

const CHECKLIST_OPTIONS = [
  { value: '',            label: 'No checklist' },
  { value: 'Onboarding', label: 'Onboarding'   },
  { value: 'Offboarding', label: 'Offboarding' },
];

const CHECKLIST_ROUTES: Record<string, string> = {
  Onboarding:  '/onboarding',
  Offboarding: '/offboarding',
};

// Onboarding fields are built dynamically (next asset # comes from the DB)
const ONBOARDING_FIELDS_BASE = 'First name, Last name, Role, Site, Start date';

function generateComputerName(
  site: keyof typeof SITES,
  role: keyof typeof ROLES,
  firstName: string,
  lastName: string
): string {
  const siteCode = SITES[site]?.code ?? '';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  return initials ? `${siteCode}-${initials}` : '';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function TaskTable({
  tasks,
  onRowClick,
  variant,
}: {
  tasks: Incident[];
  onRowClick: (task: Incident) => void;
  variant: 'inProgress' | 'queue';
}) {
  if (tasks.length === 0) {
    return (
      <div className="bg-base-100 rounded-box shadow p-4 text-center text-base-content/40 text-sm">
        No tasks
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-sm table-fixed bg-base-100 w-full">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Task Name</th>
            <th className="w-24 text-center">{variant === 'inProgress' ? 'Priority' : 'Source'}</th>
            <th className="w-28 text-center">Date Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr
              key={task.id}
              className="hover cursor-pointer"
              onClick={() => onRowClick(task)}
            >
              <td className="text-base-content/40 text-xs">{task.task_number}</td>
              <td>
                <p className="truncate font-medium text-sm">
                  {task.title || task.description.slice(0, 60)}
                </p>
              </td>
              <td className="text-center">
                {variant === 'inProgress' ? (
                  task.priority && (
                    <span className={`badge badge-sm ${PRIORITY_BADGE[task.priority]}`}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  )
                ) : (
                  task.auto_suggested && (
                    <span className="text-xs text-base-content/60 whitespace-nowrap">IT Buddy</span>
                  )
                )}
              </td>
              <td className="text-center text-xs text-base-content/70">
                {formatDate(task.date_due)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutoTextarea({
  value, onChange, onBlur, placeholder, className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      style={{ resize: 'none', overflow: 'hidden', minHeight: '2.25rem' }}
    />
  );
}

function VoiceButton({
  listening,
  onToggle,
}: {
  listening: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`btn btn-xs text-[7px] whitespace-nowrap shrink-0 ${
        listening
          ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
          : 'bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300'
      }`}
      onClick={onToggle}
    >
      {listening ? 'listening' : 'not listening'}
    </button>
  );
}

export default function PossibleDashboardPage() {
  const router = useRouter();
  const [tasks, setTasks]   = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Panel state
  const [mode, setMode]         = useState<'add' | 'update'>('add');
  const [taskNumber, setTaskNumber] = useState('');
  const [taskName, setTaskName]   = useState('');
  const [priority, setPriority]   = useState<'high' | 'low' | ''>('');
  const [dateDue, setDateDue]     = useState('');
  const [status, setStatus]       = useState<'pending' | 'in_progress' | 'resolved'>('pending');
  const [checklist, setChecklist] = useState('');
  const [infoRequired, setInfoRequired] = useState('');
  const [infoDone, setInfoDone]         = useState('');
  const [issues, setIssues]             = useState('');
  const [selectedTask, setSelectedTask] = useState<Incident | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Autosave bookkeeping
  const panelDirtyRef     = useRef(false);
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedInfoReqRef   = useRef('');   // last-saved value for each update textarea
  const savedInfoDoneRef  = useRef('');
  const savedIssuesRef    = useRef('');
  const isLoadingTaskRef  = useRef(false); // suppress checklist auto-fill while loading

  // Hire fields — populated by AI, used for localStorage navigation
  const [hireFirstName,  setHireFirstName]  = useState('');
  const [hireLastName,   setHireLastName]   = useState('');
  const [hireRole,       setHireRole]       = useState<keyof typeof ROLES>('business_office');
  const [hireSite,       setHireSite]       = useState<keyof typeof SITES>('holden');
  const [hireStartDate,  setHireStartDate]  = useState('');
  const [hireNextAsset,  setHireNextAsset]  = useState('');
  const [hireComputer,   setHireComputer]   = useState('');
  const [hireNotes,      setHireNotes]      = useState('');
  const [structuredText, setStructuredText] = useState('');  // AI output textarea
  const [pasted,         setPasted]         = useState(false);
  const [structuring,    setStructuring]    = useState(false);

  // Voice state + refs
  const [listeningNum,         setListeningNum]         = useState(false);
  const [listeningName,        setListeningName]        = useState(false);
  const [listeningDate,        setListeningDate]        = useState(false);
  const [listeningInfoRequired, setListeningInfoRequired] = useState(false);
  const [listeningInfoDone,    setListeningInfoDone]    = useState(false);
  const [listeningIssues,      setListeningIssues]      = useState(false);

  const numRecRef           = useRef<unknown>(null);
  const nameRecRef          = useRef<unknown>(null);
  const dateRecRef          = useRef<unknown>(null);
  const infoRequiredRecRef  = useRef<unknown>(null);
  const infoDoneRecRef      = useRef<unknown>(null);
  const issuesRecRef        = useRef<unknown>(null);

  const clearLastVoiceFieldRef = useRef<() => void>(() => {});

  const loadTasks = useCallback(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => { setTasks(data.incidents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetch('/api/track-click', { method: 'POST' }).catch(() => {}); }, []);

  useEffect(() => {
    loadTasks();
    fetch('/api/suggest', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.created > 0) {
          toast.success(
            `IT Buddy suggested ${data.created} new task${data.created > 1 ? 's' : ''} — check the queue.`
          );
          loadTasks();
        }
      })
      .catch(() => {});
  }, [loadTasks]);

  // Auto-populate the info-required textarea when a checklist is chosen
  useEffect(() => {
    if (isLoadingTaskRef.current) return; // task load will set infoRequired from saved updates
    if (checklist !== 'Onboarding') { setInfoRequired(''); return; }
    // Fetch assets to suggest the next asset number
    fetch('/api/assets/download')
      .then(r => r.json())
      .then(({ assets }: { assets: { asset_number: string | null }[] }) => {
        const nums = assets
          .map(a => parseInt(a.asset_number ?? ''))
          .filter(n => !isNaN(n));
        const next = nums.length > 0
          ? String(Math.max(...nums) + 1).padStart(4, '0')
          : null;
        const assetField = next ? `Next asset #${next}?` : 'Next asset #';
        setInfoRequired(`${ONBOARDING_FIELDS_BASE}, ${assetField}, Notes`);
      })
      .catch(() => setInfoRequired(`${ONBOARDING_FIELDS_BASE}, Next asset #, Notes`));
  }, [checklist]);

  // ── Autosave main fields ──────────────────────────────────────────────────
  useEffect(() => {
    if (!panelDirtyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        if (mode === 'add') {
          if (taskName.trim().length < 2) { setSaveStatus('idle'); return; }
          const res = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: taskName.trim(), priority: priority || null, screen: checklist || null, status, date_due: dateDue || null }),
          });
          if (res.ok) {
            const data = await res.json();
            setSelectedTask(data.incident);
            setTaskNumber(String(data.incident.task_number));
            setMode('update');
            loadTasks();
          }
        } else if (selectedTask) {
          await fetch(`/api/issues/${selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: taskName.trim() || null, priority: priority || null, screen: checklist || null, status, date_due: dateDue || null }),
          });
          loadTasks();
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('idle'); }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskName, priority, dateDue, status, checklist]);

  // Save a textarea as an incident_update on blur (only if changed since last save)
  async function saveUpdate(type: string, note: string, lastRef: React.MutableRefObject<string>) {
    const trimmed = note.trim();
    if (trimmed === lastRef.current || !selectedTask) return; // allow empty to persist clears
    setSaveStatus('saving');
    try {
      await fetch(`/api/issues/${selectedTask.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note: trimmed }),
      });
      lastRef.current = trimmed;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); }
  }

  function markDirty() { panelDirtyRef.current = true; }

  // Auto-generate computer name from hire fields
  useEffect(() => {
    setHireComputer(generateComputerName(hireSite, hireRole, hireFirstName, hireLastName));
  }, [hireFirstName, hireLastName, hireSite, hireRole]);

  const inProgress = useMemo(() => {
    const priorityOrder = (t: Incident) => t.priority === 'high' ? 0 : t.priority === null ? 1 : 2;
    const byDue = (t: Incident) => t.date_due ? new Date(t.date_due).getTime() : Infinity;
    return tasks
      .filter(t => t.status === 'in_progress')
      .sort((a, b) => priorityOrder(a) - priorityOrder(b) || byDue(a) - byDue(b));
  }, [tasks]);

  const queue = useMemo(
    () => tasks.filter(t => t.status === 'pending' || t.status === 'open').sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );
  const allActive = useMemo(() => [...inProgress, ...queue], [inProgress, queue]);

  function resetPanel() {
    setTaskNumber('');
    setTaskName('');
    setPriority('');
    setDateDue('');
    setStatus('pending');
    setChecklist('');
    setInfoRequired('');
    setInfoDone('');
    setIssues('');
    setSelectedTask(null);
    setHireFirstName(''); setHireLastName('');
    setHireRole('business_office'); setHireSite('holden');
    setHireStartDate(''); setHireNextAsset('');
    setHireComputer(''); setHireNotes('');
    setStructuredText(''); setPasted(false);
    panelDirtyRef.current = false;
    savedInfoReqRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = '';
  }

  function loadTask(task: Incident) {
    isLoadingTaskRef.current = true;
    setMode('update');
    setTaskNumber(String(task.task_number));
    setTaskName(task.title || task.description);
    setPriority(task.priority || '');
    setDateDue(task.date_due || '');
    const s = task.status === 'open' ? 'pending' : task.status;
    setStatus(s as 'pending' | 'in_progress' | 'resolved');
    setChecklist(task.screen || '');
    setInfoRequired('');
    setInfoDone('');
    setIssues('');
    setSelectedTask(task);
    panelDirtyRef.current = false;
    savedInfoReqRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = '';

    // Load the most recent update of each type into the textareas
    fetch(`/api/issues/${task.id}/updates`)
      .then(r => r.json())
      .then(({ updates }: { updates: { type: string; note: string }[] }) => {
        const latest = (type: string) => updates.find(u => u.type === type)?.note ?? '';
        const approach = latest('approach');
        const progress = latest('progress');
        setInfoRequired(approach);
        setInfoDone(progress);
        savedInfoReqRef.current  = approach;
        savedInfoDoneRef.current = progress;
        isLoadingTaskRef.current = false;
      })
      .catch(() => { isLoadingTaskRef.current = false; });
  }

  function handleTaskNumberInput(val: string) {
    setTaskNumber(val);
    const num = parseInt(val.trim());
    if (!isNaN(num)) {
      const found = allActive.find(t => t.task_number === num);
      if (found) loadTask(found);
    }
  }

  function parseSpokenDate(text: string): string {
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const withYear = new Date(`${text} ${new Date().getFullYear()}`);
    if (!isNaN(withYear.getTime())) return withYear.toISOString().split('T')[0];
    toast.error(`Couldn't parse "${text}" as a date`);
    return '';
  }

  function parseSpokenNumber(text: string): string {
    const digits = text.replace(/\D/g, '');
    if (digits) return digits;
    const words: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    };
    return words[text.toLowerCase().trim()] ? String(words[text.toLowerCase().trim()]) : '';
  }

  function startVoice(
    onResult: (text: string) => void,
    setActive: (v: boolean) => void,
    ref: React.MutableRefObject<unknown>,
    continuous = false
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input requires Chrome.'); return; }
    const r = new SR();
    r.continuous = continuous;
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(e.results).map((res: SpeechRecognitionResult) => res[0].transcript).join(' ');
      onResult(text);
    };
    r.onend = () => setActive(false);
    r.start();
    ref.current = r;
    setActive(true);
  }

  function stopVoice(ref: React.MutableRefObject<unknown>, setActive: (v: boolean) => void) {
    (ref.current as { stop: () => void } | null)?.stop();
    setActive(false);
  }

  function handleVoiceCommand(command: string) {
    const cmd = command.toLowerCase().trim().replace(/^[,.]?\s*/, '');
    if (cmd.includes('clear') || cmd.includes('remove') || cmd.includes('erase') || cmd.includes('delete')) {
      clearLastVoiceFieldRef.current();
      toast('Field cleared');
    } else {
      toast(`Hey Buddy didn't understand: "${command}"`);
    }
  }

  function wrapVoiceResult(onResult: (text: string) => void, clearFn: () => void) {
    return (text: string) => {
      const lower = text.toLowerCase().trim();
      if (lower.startsWith('hey buddy')) {
        const command = text.slice('hey buddy'.length).trim();
        handleVoiceCommand(command);
      } else {
        onResult(text);
        clearLastVoiceFieldRef.current = clearFn;
      }
    };
  }

  async function handleStructureIt() {
    if (!infoDone.trim()) return;
    setStructuring(true);
    try {
      const roles = Object.keys(ROLES).join(', ');
      const sites = 'holden, oakdale, business';
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Extract new hire information from this text: "${infoDone.trim()}"`,
          system: `You extract new hire information from free-form text. Return ONLY a valid JSON object with exactly these fields:
- firstName: string
- lastName: string
- role: one of [${roles}]
- site: one of [${sites}]
- startDate: YYYY-MM-DD string (or empty string if not mentioned)
- nextAssetNumber: string (or empty string if not mentioned)
- notes: string (any other info not captured above, or empty string)
Return only the JSON object, no explanation, no markdown fences.`,
        }),
      });
      const data = await res.json();
      const hire = JSON.parse(data.text);
      const fn   = hire.firstName  || '';
      const ln   = hire.lastName   || '';
      const role = (hire.role && ROLES[hire.role as keyof typeof ROLES]) ? hire.role as keyof typeof ROLES : 'business_office';
      const site = (hire.site && SITES[hire.site as keyof typeof SITES]) ? hire.site as keyof typeof SITES : 'holden';
      const comp = generateComputerName(site, role, fn, ln);

      setHireFirstName(fn);
      setHireLastName(ln);
      setHireRole(role);
      setHireSite(site);
      setHireStartDate(hire.startDate       || '');
      setHireNextAsset(hire.nextAssetNumber  || '');
      setHireComputer(comp);
      setHireNotes(hire.notes               || '');

      // Put the structured summary into its own textarea (not the original)
      const lines = [
        fn                    && `First name: ${fn}`,
        ln                    && `Last name: ${ln}`,
        ROLES[role]           && `Role: ${ROLES[role].label}`,
        SITES[site]           && `Site: ${SITES[site].label}`,
        hire.startDate        && `Start date: ${hire.startDate}`,
        hire.nextAssetNumber  && `Next asset #: ${hire.nextAssetNumber}`,
        comp                  && `Computer name: ${comp}`,
        hire.notes            && `Notes: ${hire.notes}`,
      ].filter(Boolean);
      setStructuredText(lines.join('\n'));
      setPasted(false);
    } catch {
      toast.error('Could not structure the text — try again.');
    }
    setStructuring(false);
  }

  function goToOnboarding() {
    localStorage.setItem('onboarding_prefill', JSON.stringify({
      firstName:       hireFirstName,
      lastName:        hireLastName,
      role:            hireRole,
      site:            hireSite,
      startDate:       hireStartDate,
      nextAssetNumber: hireNextAsset,
      computerName:    hireComputer,
      notes:           hireNotes,
    }));
    router.push('/onboarding');
  }

  async function handleSeedData() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to load demo data'); }
      else { toast.success('Demo data loaded!'); loadTasks(); }
    } catch {
      toast.error('Failed to load demo data');
    }
    setSeeding(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-base-200 px-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">

        {/* Tables column */}
        <div className="space-y-6">

          {/* In Progress */}
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in process</h2>
            <TaskTable tasks={inProgress} onRowClick={loadTask} variant="inProgress" />
          </div>

          {/* Queue */}
          <div>
            <h2 className="text-lg font-bold mb-2">Tasks in the queue</h2>
            <TaskTable tasks={queue} onRowClick={loadTask} variant="queue" />
            {tasks.length === 0 && (
              <button
                className="btn btn-outline btn-sm w-full mt-2"
                onClick={handleSeedData}
                disabled={seeding}
              >
                {seeding ? <span className="loading loading-spinner loading-sm" /> : 'Load Demo Data'}
              </button>
            )}
          </div>

        </div>

        {/* Add / Update Panel */}
        <div className="lg:sticky lg:top-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-3">

              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm flex-1 ${mode === 'add' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setMode('add'); resetPanel(); }}
                >
                  Add
                </button>
                <button
                  className={`btn btn-sm flex-1 ${mode === 'update' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setMode('update'); resetPanel(); }}
                >
                  Update
                </button>
              </div>

              {/* Task # (update mode) */}
              {mode === 'update' && (
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    placeholder="Task # (or click a row)"
                    value={taskNumber}
                    onChange={e => handleTaskNumberInput(e.target.value)}
                  />
                  <VoiceButton
                    listening={listeningNum}
                    onToggle={() => listeningNum
                      ? stopVoice(numRecRef as React.MutableRefObject<unknown>, setListeningNum)
                      : startVoice(
                          wrapVoiceResult(
                            text => handleTaskNumberInput(parseSpokenNumber(text)),
                            () => handleTaskNumberInput('')
                          ),
                          setListeningNum,
                          numRecRef as React.MutableRefObject<unknown>,
                          false
                        )
                    }
                  />
                </div>
              )}

              {/* Task Name */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">
                    Task Name{mode === 'add' ? ' *' : ''}
                  </span>
                </label>
                <div className="flex gap-1">
                  <input
                    className="input input-bordered input-sm flex-1"
                    value={taskName}
                    onChange={e => { setTaskName(e.target.value); markDirty(); }}
                    placeholder={mode === 'add' ? 'Describe the task...' : ''}
                  />
                  <VoiceButton
                    listening={listeningName}
                    onToggle={() => listeningName
                      ? stopVoice(nameRecRef as React.MutableRefObject<unknown>, setListeningName)
                      : startVoice(
                          wrapVoiceResult(
                            text => setTaskName(prev => prev ? `${prev} ${text}` : text),
                            () => setTaskName('')
                          ),
                          setListeningName,
                          nameRecRef as React.MutableRefObject<unknown>,
                          true
                        )
                    }
                  />
                </div>
              </div>

              {/* Priority + Date Due (two-column row) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Priority</span>
                  </label>
                  <div className="flex gap-1">
                    {(['high', 'low'] as const).map(p => (
                      <button
                        key={p}
                        className={`btn btn-xs flex-1 capitalize ${priority === p
                          ? p === 'high' ? 'btn-error' : 'btn-success'
                          : 'btn-outline'}`}
                        onClick={() => { setPriority(prev => prev === p ? '' : p); markDirty(); }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Date Due</span>
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      className="input input-bordered input-sm flex-1 min-w-0"
                      value={dateDue}
                      onChange={e => { setDateDue(e.target.value); markDirty(); }}
                    />
                    <VoiceButton
                      listening={listeningDate}
                      onToggle={() => listeningDate
                        ? stopVoice(dateRecRef as React.MutableRefObject<unknown>, setListeningDate)
                        : startVoice(
                            wrapVoiceResult(
                              text => { const d = parseSpokenDate(text); if (d) setDateDue(d); },
                              () => setDateDue('')
                            ),
                            setListeningDate,
                            dateRecRef as React.MutableRefObject<unknown>,
                            false
                          )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status + Checklist (two-column row) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Status</span>
                  </label>
                  <div className="flex gap-1">
                    <button
                      className={`btn btn-xs flex-1 ${status === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { setStatus('pending'); markDirty(); }}
                    >
                      Queue
                    </button>
                    <button
                      className={`btn btn-xs flex-1 ${status === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { setStatus('in_progress'); markDirty(); }}
                    >
                      In&nbsp;Progress
                    </button>
                    {mode === 'update' && (
                      <button
                        className={`btn btn-xs flex-1 ${status === 'resolved' ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => { setStatus('resolved'); markDirty(); }}
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Checklist</span>
                  </label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={checklist}
                    onChange={e => { setChecklist(e.target.value); markDirty(); }}
                  >
                    {CHECKLIST_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Information required or checklist */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Information required or checklist</span>
                </label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={infoRequired}
                    onChange={e => setInfoRequired(e.target.value)}
                    onBlur={() => saveUpdate('approach', infoRequired, savedInfoReqRef)}
                    placeholder="What information is needed or what does the checklist say..."
                  />
                  <VoiceButton
                    listening={listeningInfoRequired}
                    onToggle={() => listeningInfoRequired
                      ? stopVoice(infoRequiredRecRef as React.MutableRefObject<unknown>, setListeningInfoRequired)
                      : startVoice(
                          wrapVoiceResult(
                            text => setInfoRequired(prev => prev ? `${prev} ${text}` : text),
                            () => setInfoRequired('')
                          ),
                          setListeningInfoRequired,
                          infoRequiredRecRef as React.MutableRefObject<unknown>,
                          true
                        )
                    }
                  />
                </div>
              </div>

              {/* Information gotten or what was done */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Information gotten or what was done</span>
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
                      : startVoice(
                          wrapVoiceResult(
                            text => setInfoDone(prev => prev ? `${prev} ${text}` : text),
                            () => setInfoDone('')
                          ),
                          setListeningInfoDone,
                          infoDoneRecRef as React.MutableRefObject<unknown>,
                          true
                        )
                    }
                  />
                </div>

                {/* Structure it — only shown for Onboarding when textarea has text */}
                {checklist === 'Onboarding' && infoDone.trim() && (
                  <button
                    className="btn btn-outline btn-sm mt-2 w-full"
                    onClick={handleStructureIt}
                    disabled={structuring}
                  >
                    {structuring && <span className="loading loading-spinner loading-xs" />}
                    {structuring ? 'Structuring…' : 'Structure it'}
                  </button>
                )}

                {/* Go to Onboarding Checklist — appears after user pastes structured text */}
                {checklist === 'Onboarding' && pasted && (
                  <button className="btn btn-primary btn-sm mt-2 w-full gap-1" onClick={goToOnboarding}>
                    Go to Onboarding Checklist <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Structured text textarea — appears after AI runs, before paste */}
              {checklist === 'Onboarding' && structuredText && !pasted && (
                <div className="space-y-2">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm w-full text-sm font-mono"
                    value={structuredText}
                    onChange={e => setStructuredText(e.target.value)}
                  />
                  <button
                    className="btn btn-outline btn-sm w-full"
                    onClick={() => {
                      setInfoDone(structuredText);
                      setPasted(true);
                      saveUpdate('progress', structuredText, savedInfoDoneRef);
                    }}
                  >
                    Paste into Information gotten or what was done
                  </button>
                </div>
              )}

              {/* Issues / Comments */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Issues / Comments</span>
                </label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={issues}
                    onChange={e => setIssues(e.target.value)}
                    onBlur={() => saveUpdate('progress', issues.trim() ? `Issues/Comments: ${issues.trim()}` : '', savedIssuesRef)}
                    placeholder="Any issues or comments..."
                  />
                  <VoiceButton
                    listening={listeningIssues}
                    onToggle={() => listeningIssues
                      ? stopVoice(issuesRecRef as React.MutableRefObject<unknown>, setListeningIssues)
                      : startVoice(
                          wrapVoiceResult(
                            text => setIssues(prev => prev ? `${prev} ${text}` : text),
                            () => setIssues('')
                          ),
                          setListeningIssues,
                          issuesRecRef as React.MutableRefObject<unknown>,
                          true
                        )
                    }
                  />
                </div>
              </div>

              {/* View details link */}
              {mode === 'update' && selectedTask && (
                <Link
                  href={`/issues/${selectedTask.id}`}
                  className="btn btn-ghost btn-xs gap-1 w-full"
                >
                  <ExternalLink className="w-3 h-3" /> View full details
                </Link>
              )}

              {/* Autosave status */}
              <div className="h-4 text-right">
                {saveStatus === 'saving' && <span className="text-xs text-base-content/40">Saving…</span>}
                {saveStatus === 'saved'  && <span className="text-xs text-success">Saved ✓</span>}
              </div>

              {/* Load demo data (only when no tasks exist) */}
              {tasks.length === 0 && (
                <button
                  className="btn btn-ghost btn-xs w-full"
                  onClick={handleSeedData}
                  disabled={seeding}
                >
                  {seeding ? <span className="loading loading-spinner loading-sm" /> : 'Load Demo Data'}
                </button>
              )}

            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

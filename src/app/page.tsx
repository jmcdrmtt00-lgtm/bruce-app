'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident, IncidentUpdate } from '@/types';
import { TASK_TYPES, QUICK_TASK_TYPES } from '@/data/taskRequirements';
import { formatDate } from '@/lib/formatDate';
import AiDiagnoseSection from '@/components/AiDiagnoseSection';

interface UnassignedAsset {
  id: string;
  asset_number: string | null;
  name: string | null;
  make: string | null;
  model: string | null;
  os: string | null;
  ram: string | null;
  site: string;
  assigned_to?: string | null;
}

interface AssetGroup {
  make: string;
  available: UnassignedAsset[];  // unassigned units of this make
  expanded: boolean;
}

interface CategoryState {
  groups:   AssetGroup[];
  approved: UnassignedAsset | null;
  proposed: string;   // make name randomly chosen as the proposal
  newMake:  string;   // "Buy this" free-text input
  ownsThis: string;   // "Onboard owns this" free-text input
}

const emptyCat = (): CategoryState =>
  ({ groups: [], approved: null, proposed: '', newMake: '', ownsThis: '' });

const SITE_LABELS: Record<string, string> = {
  holden:          'Holden',
  oakdale:         'Oakdale',
  business_office: 'Business Office',
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-error',
  low:  'badge-success',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'H', low: 'L',
};

function normalizeScreenToTypeId(screen: string): string {
  if (!screen) return '';
  if (TASK_TYPES[screen]) return screen;
  const lower = screen.toLowerCase().replace(/[\s-]/g, '_');
  if (TASK_TYPES[lower]) return lower;
  return '';
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
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-xs table-fixed bg-base-100 w-full">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th className="w-14 text-center">Urgency</th>
            <th className="text-left">Task Name</th>
            <th className="w-28">Requester</th>
            <th className="w-24 text-center">Target Date</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr><td colSpan={5} className="text-center text-base-content/40 text-sm py-3">No tasks</td></tr>
          ) : tasks.map(task => (
            <tr
              key={task.id}
              className="hover cursor-pointer [&>td]:py-0.5"
              onClick={() => onRowClick(task)}
            >
              <td className="text-base-content/40 text-xs">{task.task_number}</td>
              <td className="text-center">
                {task.priority && (
                  <span className={`badge badge-sm ${PRIORITY_BADGE[task.priority]}`}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                )}
              </td>
              <td>
                <p className="truncate font-medium text-sm">
                  {task.title || task.description.slice(0, 60)}
                </p>
              </td>
              <td className="text-xs text-base-content/70 truncate max-w-0">
                {task.reported_by || ''}
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

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks]   = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Panel state
  const [taskNumber, setTaskNumber] = useState('');
  const [taskName, setTaskName]   = useState('');
  const [priority, setPriority]   = useState<'high' | 'low' | ''>('');
  const [dateDue, setDateDue]     = useState('');
  const [status, setStatus]       = useState<'pending' | 'in_progress' | 'resolved'>('pending');
  const [requester, setRequester] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Add task modal state
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [newTaskName,      setNewTaskName]      = useState('');
  const [newTaskDetails,   setNewTaskDetails]   = useState('');
  const [newTaskRequester, setNewTaskRequester] = useState('');
  const [newTaskPriority,  setNewTaskPriority]  = useState<'high' | 'low' | ''>('');
  const [newTaskType,      setNewTaskType]      = useState('');
  const [listeningNewName,    setListeningNewName]    = useState(false);
  const [listeningNewDetails, setListeningNewDetails] = useState(false);
  const [allUpdates,       setAllUpdates]       = useState<IncidentUpdate[]>([]);
  const [historyOpen,      setHistoryOpen]      = useState(false);
  const [infoRequired, setInfoRequired] = useState('');
  const [infoDone, setInfoDone]         = useState('');
  const [issues, setIssues]             = useState('');
  const [selectedTask, setSelectedTask] = useState<Incident | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Problem type state
  const [selectedType,     setSelectedType]     = useState<string>('general');
  const [diagnosing,       setDiagnosing]       = useState(false); // onboarding AI call only
  const [diagStage,        setDiagStage]        = useState<'idle' | 'cause'>('idle'); // onboarding only

  // AI section state — non-onboarding types, driven by AiDiagnoseSection
  const [aiStage,                   setAiStage]                   = useState('idle');
  const [initialDiagCause,          setInitialDiagCause]          = useState<string | null>(null);
  const [initialDiagActionsText,    setInitialDiagActionsText]    = useState<string | null>(null);
  const [initialDiagRecommendation, setInitialDiagRecommendation] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<Record<string, string> | null>(null);
  const [computer, setComputer] = useState<CategoryState>(emptyCat());
  const [phone,    setPhone]    = useState<CategoryState>(emptyCat());
  const [ipad,     setIpad]     = useState<CategoryState>(emptyCat());

  // Autosave bookkeeping
  const panelDirtyRef     = useRef(false);
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedInfoReqRef   = useRef('');
  const savedInfoDoneRef  = useRef('');
  const savedIssuesRef    = useRef('');
  const savedDetailsRef   = useRef('');

  // Voice state + refs
  const [listeningNum,          setListeningNum]          = useState(false);
  const [listeningName,         setListeningName]         = useState(false);
  const [listeningDate,         setListeningDate]         = useState(false);
  const [listeningInfoRequired, setListeningInfoRequired] = useState(false);
  const [listeningInfoDone,     setListeningInfoDone]     = useState(false);
  const [listeningIssues,         setListeningIssues]         = useState(false);
  const [listeningRequester,      setListeningRequester]      = useState(false);
  const numRecRef           = useRef<unknown>(null);
  const nameRecRef          = useRef<unknown>(null);
  const dateRecRef          = useRef<unknown>(null);
  const infoRequiredRecRef  = useRef<unknown>(null);
  const infoDoneRecRef      = useRef<unknown>(null);
  const issuesRecRef        = useRef<unknown>(null);
  const requesterRecRef     = useRef<unknown>(null);

  const clearLastVoiceFieldRef = useRef<() => void>(() => {});
  const newNameRecRef    = useRef<unknown>(null);
  const newDetailsRecRef = useRef<unknown>(null);

  const loadTasks = useCallback(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => { setTasks((data.incidents ?? []).filter((i: Incident) => i.task_number != null)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetch('/api/track-click', { method: 'POST' }).catch(() => {}); }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Autosave main fields ──────────────────────────────────────────────────
  useEffect(() => {
    if (!panelDirtyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        if (selectedTask) {
          await fetch(`/api/issues/${selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: taskName.trim() || null, priority: priority || null, screen: selectedType || null, status, date_due: dateDue || null, reported_by: requester.trim() || null, assigned_to: assignedTo || null }),
          });
          loadTasks();
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('idle'); }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskName, priority, dateDue, status, selectedType, requester, assignedTo]);

  // Save a textarea as an incident_update on blur (only if changed since last save)
  async function saveUpdate(type: string, note: string, lastRef: React.MutableRefObject<string>) {
    const trimmed = note.trim();
    if (trimmed === lastRef.current || !selectedTask) return;
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
    setRequester('');
    setAssignedTo('');
    setInfoRequired('');
    setInfoDone('');
    setIssues('');
    setSelectedTask(null);
    setSelectedType('general');
    setDiagStage('idle');
    setAiStage('idle');
    setInitialDiagCause(null); setInitialDiagActionsText(null); setInitialDiagRecommendation(null);
    setOnboardingData(null);
    setComputer(emptyCat()); setPhone(emptyCat()); setIpad(emptyCat());
    setAllUpdates([]); setHistoryOpen(false);
    panelDirtyRef.current = false;
    savedInfoReqRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = ''; savedDetailsRef.current = '';
  }

  function loadTask(task: Incident) {
    setTaskNumber(String(task.task_number));
    setTaskName(task.title || task.description);
    setPriority(task.priority || '');
    setDateDue(task.date_due || '');
    const s = task.status === 'open' ? 'pending' : task.status;
    setStatus(s as 'pending' | 'in_progress' | 'resolved');
    setRequester(task.reported_by || '');
    setAssignedTo(task.assigned_to || '');

    // Normalize screen → problem type ID, default to 'general'
    const rawScreen = task.screen || '';
    const typeId = normalizeScreenToTypeId(rawScreen) || 'problem_to_fix';
    setSelectedType(typeId);

    setInfoDone('');
    setIssues('');
    setDiagStage('idle');
    setAiStage('idle');
    setInitialDiagCause(null); setInitialDiagActionsText(null); setInitialDiagRecommendation(null);
    setOnboardingData(null);
    setComputer(emptyCat()); setPhone(emptyCat()); setIpad(emptyCat());
    setAllUpdates([]); setHistoryOpen(false);
    setSelectedTask(task);
    panelDirtyRef.current = false;
    savedInfoReqRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = ''; savedDetailsRef.current = '';

    // Set infoRequired from type fields immediately
    setInfoRequired(TASK_TYPES[typeId]
      ? `Information needed: ${TASK_TYPES[typeId].fields.join(', ')}`
      : '');

    // Load updates
    fetch(`/api/issues/${task.id}/updates`)
      .then(r => r.json())
      .then(({ updates }: { updates: IncidentUpdate[] }) => {
        setAllUpdates(updates);
        const latest = (t: string) => updates.filter(u => u.type === t).at(-1)?.note ?? '';

        const progress = latest('progress');
        setInfoDone(progress);
        savedInfoDoneRef.current = progress;

        const details = latest('details');
        if (details) {
          setInfoRequired(details);
          savedDetailsRef.current = details;
        }

        // Restore AI-generated content from saved ai_response updates
        const aiUpdates = updates.filter(u => u.type === 'ai_response');
        let restoredCause: string | null = null;
        let restoredActions: string | null = null;
        let restoredRecommendation: string | null = null;
        for (const u of aiUpdates) {
          if (u.note.startsWith('Cause: '))          restoredCause = u.note.slice('Cause: '.length);
          if (u.note.startsWith('Fix steps: '))      restoredActions = u.note.slice('Fix steps: '.length);
          if (u.note.startsWith('Recommendation: ')) restoredRecommendation = u.note.slice('Recommendation: '.length);
        }
        setInitialDiagCause(restoredCause);
        setInitialDiagActionsText(restoredActions
          ? restoredActions.split(' | ').map((s, i) => `${i + 1}. ${s}`).join('\n')
          : null);
        setInitialDiagRecommendation(restoredRecommendation);
      })
      .catch(() => {});
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
    r.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      const text = e.results[e.resultIndex][0].transcript;
      onResult(text);
    };
    r.onerror = (e: { error: string }) => {
      setActive(false);
      if (e.error === 'not-allowed') {
        toast.error('Microphone access was denied. Check your browser permissions.');
      } else if (e.error === 'no-speech') {
        // silence — no speech detected is normal
      } else {
        toast.error(`Voice error: ${e.error}`);
      }
    };
    r.onend = () => setActive(false);
    try {
      r.start();
      ref.current = r;
      setActive(true);
    } catch (err) {
      toast.error(`Could not start voice input: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  function selectProblemType(id: string) {
    setSelectedType(id);
    const pt = TASK_TYPES[id];
    if (!pt) return;

    setInfoRequired(`Information needed: ${pt.fields.join(', ')}`);

    markDirty();
  }

  function buildAssetGroups(assets: UnassignedAsset[]): AssetGroup[] {
    const makeMap = new Map<string, UnassignedAsset[]>();
    for (const asset of assets) {
      const make = asset.make || '(Unknown)';
      if (!makeMap.has(make)) makeMap.set(make, []);
      makeMap.get(make)!.push(asset);
    }
    return Array.from(makeMap.entries())
      .map(([make, units]) => ({
        make,
        available: units.filter(u => !u.assigned_to),
        expanded: false,
      }))
      .sort((a, b) => a.make.localeCompare(b.make));
  }

  function pickProposed(groups: AssetGroup[]): string {
    const pool = groups.filter(g => g.available.length > 0);
    const src  = pool.length > 0 ? pool : groups;
    if (src.length === 0) return '';
    return src[Math.floor(Math.random() * src.length)].make;
  }

  async function handleApproveAsset(
    asset: UnassignedAsset,
    category: 'Computer' | 'Phone' | 'iPad',
  ) {
    if (!onboardingData) return;
    const fullName = `${onboardingData.firstName ?? ''} ${onboardingData.lastName ?? ''}`.trim();
    try {
      const res = await fetch(`/api/assets/${asset.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: fullName }),
      });
      if (!res.ok) throw new Error();
      const setter = category === 'Computer' ? setComputer : category === 'Phone' ? setPhone : setIpad;
      setter(prev => ({ ...prev, approved: asset }));
      toast.success(`${category} assigned to ${fullName}!`);
    } catch {
      toast.error('Could not assign asset — try again.');
    }
  }

  // Onboarding-only: AI extracts structured data then shows asset proposals inline
  async function handleDiagnose() {
    if (!infoDone.trim() && !infoRequired.trim()) {
      router.push('/onboarding');
      return;
    }
    setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_type: 'onboarding',
          stage: 'symptoms',
          task_details: infoRequired || null,
          information: infoDone || null,
        }),
      });
      const data = await res.json();
      if (data.structured_data !== undefined) {
        localStorage.setItem('onboarding_prefill', JSON.stringify(data.structured_data));
        setOnboardingData(data.structured_data);
        setComputer(emptyCat()); setPhone(emptyCat()); setIpad(emptyCat());
        const siteLabel = SITE_LABELS[data.structured_data.site ?? ''] ?? '';
        if (siteLabel) {
          const [compRes, phoneRes, ipadRes] = await Promise.all([
            fetch(`/api/assets/site-inventory?site=${encodeURIComponent(siteLabel)}&category=Computer`),
            fetch(`/api/assets/site-inventory?site=${encodeURIComponent(siteLabel)}&category=Phone`),
            fetch(`/api/assets/site-inventory?site=${encodeURIComponent(siteLabel)}&category=iPad`),
          ]);
          const [compData, phoneData, ipadData] = await Promise.all([
            compRes.json(), phoneRes.json(), ipadRes.json(),
          ]);
          const compGroups  = buildAssetGroups(compData.assets ?? []);
          const phoneGroups = buildAssetGroups(phoneData.assets ?? []);
          const ipadGroups  = buildAssetGroups(ipadData.assets ?? []);
          setComputer(prev => ({ ...prev, groups: compGroups,  proposed: pickProposed(compGroups)  }));
          setPhone   (prev => ({ ...prev, groups: phoneGroups, proposed: pickProposed(phoneGroups) }));
          setIpad    (prev => ({ ...prev, groups: ipadGroups,  proposed: pickProposed(ipadGroups)  }));
        }
        setDiagStage('cause');
      }
    } catch {
      toast.error('Could not get AI response — try again.');
    }
    setDiagnosing(false);
  }

  async function handleAddTask() {
    if (!newTaskName.trim()) return;
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskName.trim(), status: 'pending', reported_by: newTaskRequester.trim() || null, priority: newTaskPriority || null, description: newTaskDetails.trim() || newTaskName.trim(), screen: newTaskType || null }),
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
        setShowAddModal(false);
        setNewTaskName(''); setNewTaskDetails('');
        setNewTaskRequester(''); setNewTaskPriority(''); setNewTaskType('');
        loadTasks();
        loadTask(data.incident);
      }
    } catch {
      toast.error('Failed to add task');
    }
  }

  async function handleDelete() {
    if (!selectedTask) return;
    const res = await fetch(`/api/issues/${selectedTask.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Failed to delete task');
      return;
    }
    resetPanel();
    loadTasks();
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

  // Suppress unused variable warnings for voice refs not used in current render
  void numRecRef; void parseSpokenNumber; void listeningNum; void setListeningNum;

  const isOnboarding = selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding';
  const hideInfoDone = !isOnboarding && (aiStage === 'fix' || aiStage === 'recommendation');

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
          </div>

        </div>

        {/* Add / Update Panel */}
        <div className="lg:sticky lg:top-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-2">

              {/* Add task button */}
              <div className="flex justify-between items-center">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setShowAddModal(true); setNewTaskName(''); setNewTaskDetails(''); }}
                >
                  + Add task
                </button>
                {selectedTask && (
                  <button className="btn btn-ghost btn-xs text-base-content/40" onClick={resetPanel}>
                    clear
                  </button>
                )}
              </div>

              {/* Task fields */}
              <>
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
                    onChange={e => handleTaskNumberInput(e.target.value)}
                  />
                  <input
                    className="input input-bordered input-sm flex-1"
                    value={taskName}
                    onChange={e => { setTaskName(e.target.value); markDirty(); }}
                    placeholder=""
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

              {/* Priority + Status + Date Due (three-column row) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Urgency</span>
                  </label>
                  <select
                    className="select select-bordered select-sm text-sm w-full"
                    value={priority}
                    onChange={e => { setPriority(e.target.value as 'high' | 'low' | ''); markDirty(); }}
                  >
                    <option value="">—</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Status</span>
                  </label>
                  <select
                    className="select select-bordered select-sm text-sm w-full"
                    value={status}
                    onChange={e => { setStatus(e.target.value as 'pending' | 'in_progress' | 'resolved'); markDirty(); }}
                  >
                    <option value="pending">Queue</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Complete</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Target Date</span>
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

              {/* Requester + Assigned to + Task type */}
              <div className="grid grid-cols-3 gap-2">
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Requester</span>
                  </label>
                  <div className="flex gap-1">
                    <input
                      className="input input-bordered input-sm flex-1 min-w-0"
                      value={requester}
                      onChange={e => { setRequester(e.target.value); markDirty(); }}
                      placeholder=""
                    />
                    <VoiceButton
                      listening={listeningRequester}
                      onToggle={() => listeningRequester
                        ? stopVoice(requesterRecRef as React.MutableRefObject<unknown>, setListeningRequester)
                        : startVoice(
                            wrapVoiceResult(
                              text => setRequester(prev => prev ? `${prev} ${text}` : text),
                              () => setRequester('')
                            ),
                            setListeningRequester,
                            requesterRecRef as React.MutableRefObject<unknown>,
                            true
                          )
                      }
                    />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Assigned to</span>
                  </label>
                  <select className="select select-bordered select-sm text-sm w-full" value={assignedTo}
                    onChange={e => { setAssignedTo(e.target.value); markDirty(); }}>
                    <option value="">Unassigned</option>
                    <option value="Bruce">Bruce</option>
                    <option value="John">John</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Task type</span>
                  </label>
                  <select
                    className="select select-bordered select-sm text-sm w-full"
                    value={selectedType}
                    onChange={e => selectProblemType(e.target.value)}
                  >
                    {QUICK_TASK_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Task details — only for onboarding/offboarding */}
              {(selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding') && <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Information needed</span>
                </label>
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
              </div>}

              {/* infoDone — label varies by task type; hidden when AiDiagnoseSection shows fix/recommendation */}
              <div className={`form-control${hideInfoDone ? ' hidden' : ''}`}>
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">
                    {selectedType === 'problem_to_fix' ? 'Problem to fix'
                      : selectedType === 'decision_to_make' ? 'Decision to make'
                      : selectedType === 'project_to_manage' ? 'Project to manage'
                      : 'Information to send to the AI'}
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
                {/* Onboarding: Ask the AI button (non-onboarding types get their button from AiDiagnoseSection) */}
                {isOnboarding && diagStage === 'idle' && (
                  <div className="mt-2">
                    <button
                      className="btn btn-primary btn-sm w-full"
                      onClick={handleDiagnose}
                      disabled={diagnosing}
                    >
                      {diagnosing && <span className="loading loading-spinner loading-xs" />}
                      {diagnosing ? 'Thinking…' : 'Ask the AI'}
                    </button>
                  </div>
                )}
              </div>

              {/* Onboarding asset proposals — shown after AI extracts structured data */}
              {diagStage === 'cause' && isOnboarding && onboardingData && (
                <div className="form-control">
                  <div className="rounded-box p-3 bg-primary/10 space-y-4">

                      {(['Computer', 'Phone', 'iPad'] as const).map(cat => {
                        const catState = cat === 'Computer' ? computer : cat === 'Phone' ? phone : ipad;
                        const setCat   = cat === 'Computer' ? setComputer : cat === 'Phone' ? setPhone : setIpad;
                        const { groups, approved, newMake, ownsThis } = catState;
                        const visibleGroups = groups.filter(g => g.make !== '(Unknown)');
                        return (
                          <div key={cat} className="space-y-1">
                            <p className="text-xs font-semibold text-base-content/50">{cat}</p>

                            {approved ? (
                              <p className="text-sm text-success">
                                ✓ {approved.make || cat}
                                {approved.asset_number ? ` — Asset #${approved.asset_number}` : ''} assigned
                              </p>
                            ) : (
                              <>
                                {/* One row per make */}
                                {visibleGroups.map(group => {
                                  const { make, available, expanded } = group;
                                  const hasAvail = available.length > 0;
                                  const first    = available[0];
                                  return (
                                    <div key={make}>
                                      <div className="bg-base-100 rounded p-2 flex items-center justify-between gap-2">
                                        {hasAvail ? (
                                          <div className="text-sm min-w-0">
                                            <span className="font-medium">{make}</span>
                                            {available.length === 1 ? (
                                              <span className="text-base-content/60 text-xs ml-1">
                                                {[first.model, first.ram].filter(Boolean).join(', ')}
                                                {first.asset_number ? ` #${first.asset_number}` : ''}
                                              </span>
                                            ) : (
                                              <span className="text-base-content/60 text-xs ml-1">
                                                {first.asset_number ? `#${first.asset_number}` : ''}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-sm min-w-0">
                                            <span className="font-medium">{make}</span>
                                            <span className="text-base-content/40 text-xs ml-1">(none available)</span>
                                          </div>
                                        )}
                                        {hasAvail ? (
                                          available.length === 1 ? (
                                            <button
                                              className="btn btn-primary btn-xs shrink-0"
                                              onClick={() => handleApproveAsset(first, cat)}
                                            >Approve</button>
                                          ) : (
                                            <button
                                              className="btn btn-outline btn-xs shrink-0"
                                              onClick={() => setCat(prev => ({
                                                ...prev,
                                                groups: prev.groups.map(g => g.make === make ? { ...g, expanded: !g.expanded } : g),
                                              }))}
                                            >{expanded ? 'Hide' : `Show these (${available.length})`}</button>
                                          )
                                        ) : (
                                          <button
                                            className="btn btn-outline btn-xs shrink-0"
                                            onClick={() => setCat(prev => ({ ...prev, newMake: make }))}
                                          >Buy this</button>
                                        )}
                                      </div>
                                      {/* Expanded individual units */}
                                      {expanded && (
                                        <div className="pl-2 pt-1 space-y-1">
                                          {available.map(asset => (
                                            <div key={asset.id} className="bg-base-100 rounded px-2 py-1 flex items-center justify-between gap-2">
                                              <span className="text-xs">
                                                {[asset.model, asset.ram].filter(Boolean).join(', ')}
                                                {asset.asset_number ? ` #${asset.asset_number}` : ''}
                                              </span>
                                              <button
                                                className="btn btn-primary btn-xs shrink-0"
                                                onClick={() => handleApproveAsset(asset, cat)}
                                              >Approve</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Buy this (new make) */}
                                <div className="flex gap-1 items-center pt-1">
                                  <input
                                    type="text"
                                    className="input input-bordered input-xs flex-1"
                                    placeholder="Buy this — make not yet at this site"
                                    value={newMake}
                                    onChange={e => setCat(prev => ({ ...prev, newMake: e.target.value }))}
                                  />
                                  <button
                                    className="btn btn-outline btn-xs shrink-0"
                                    disabled={!newMake.trim()}
                                    onClick={() => toast(`Noted: order ${newMake} for ${cat}`)}
                                  >Buy this</button>
                                </div>

                                {/* Onboard owns this */}
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="text"
                                    className="input input-bordered input-xs flex-1"
                                    placeholder="Onboard owns this — make/model"
                                    value={ownsThis}
                                    onChange={e => setCat(prev => ({ ...prev, ownsThis: e.target.value }))}
                                  />
                                  <button
                                    className="btn btn-outline btn-xs shrink-0 text-[10px]"
                                    disabled={!ownsThis.trim()}
                                    onClick={() => toast(`Noted: employee owns their ${cat} (${ownsThis})`)}
                                  >Owns this</button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      <button
                        className="btn btn-primary btn-sm w-full"
                        onClick={() => router.push('/onboarding')}
                      >
                        Open checklist →
                      </button>
                    </div>
                  </div>
                )}

              {/* AI Diagnose Section — all non-onboarding task types */}
              {!isOnboarding && (
                <AiDiagnoseSection
                  key={selectedTask?.id}
                  selectedType={selectedType}
                  infoDone={infoDone}
                  setInfoDone={setInfoDone}
                  infoRequired={infoRequired}
                  onSaveUpdate={async (type, note) => {
                    if (!selectedTask) return;
                    await fetch(`/api/issues/${selectedTask.id}/updates`, {
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

              {/* Delete */}
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

              {selectedTask && (
                <div className="flex justify-end">
                  <button
                    className="btn btn-ghost btn-xs text-base-content/25 hover:text-error hover:bg-transparent"
                    onClick={handleDelete}
                    title="Delete task"
                  >
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
      {/* Add task modal */}
      {showAddModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold mb-3">Add task</h3>
            <div className="space-y-2 mb-3">
              <div className="flex gap-1 items-center">
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="Task name *"
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  autoFocus
                />
                <VoiceButton
                  listening={listeningNewName}
                  onToggle={() => listeningNewName
                    ? stopVoice(newNameRecRef, setListeningNewName)
                    : startVoice(t => setNewTaskName(prev => prev ? `${prev} ${t}` : t), setListeningNewName, newNameRecRef, false)
                  }
                />
              </div>
              <div className="flex gap-1 items-start">
                <AutoTextarea
                  className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                  value={newTaskDetails}
                  onChange={e => setNewTaskDetails(e.target.value)}
                  placeholder="Task details *"
                />
                <VoiceButton
                  listening={listeningNewDetails}
                  onToggle={() => listeningNewDetails
                    ? stopVoice(newDetailsRecRef, setListeningNewDetails)
                    : startVoice(t => setNewTaskDetails(prev => prev ? `${prev} ${t}` : t), setListeningNewDetails, newDetailsRecRef, true)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="Requester"
                  value={newTaskRequester}
                  onChange={e => setNewTaskRequester(e.target.value)}
                />
                <select className="select select-bordered select-sm w-full" value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as 'high' | 'low' | '')}>
                  <option value="">Urgency —</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <select className="select select-bordered select-sm w-full" value={newTaskType}
                onChange={e => setNewTaskType(e.target.value)}>
                <option value="">Select task type *</option>
                <option value="problem_to_fix">Problem to fix</option>
                <option value="decision_to_make">Decision to make</option>
                <option value="onboarding">Onboarding</option>
                <option value="offboarding">Offboarding</option>
              </select>
            </div>
            <div className="modal-action mt-0">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddModal(false); setNewTaskName(''); setNewTaskDetails(''); setNewTaskRequester(''); setNewTaskPriority(''); setNewTaskType(''); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddTask} disabled={!newTaskName.trim() || !newTaskDetails.trim() || !newTaskType}>Save</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)} />
        </dialog>
      )}
    </main>
  );
}

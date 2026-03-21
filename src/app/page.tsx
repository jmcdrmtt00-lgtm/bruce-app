'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
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


function normalizeScreenToTypeId(screen: string): string {
  if (!screen) return '';
  if (TASK_TYPES[screen]) return screen;
  const lower = screen.toLowerCase().replace(/[\s-]/g, '_');
  if (TASK_TYPES[lower]) return lower;
  return '';
}


function AutoTextarea({
  value, onChange, onBlur, placeholder, className, style,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
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
      style={{ resize: 'none', overflow: 'hidden', minHeight: '2.25rem', ...style }}
    />
  );
}

function VoiceButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={listening ? 'Stop listening' : 'Tap to speak'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: listening ? '#22cc6e' : '#a8b8c8',
        filter: listening ? 'drop-shadow(0 0 5px rgba(34,204,110,0.7))' : 'none',
        animation: listening ? 'micPulse 1.4s ease-in-out infinite' : 'none',
      }}
    >
      <svg width="13" height="16" viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3.5" y="0.75" width="6" height="8.5" rx="3" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 8.5C1 11.54 3.46 14 6.5 14s5.5-2.46 5.5-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="6.5" y1="14" x2="6.5" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks]   = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Left panel view
  const [activeView, setActiveView]   = useState<'open' | 'needs_info' | 'completed'>('open');
  const [filterPriority, setFilterPriority] = useState('');
  const [visibleCols, setVisibleCols] = useState({ requester: true, dateSubmitted: false, targetDate: true });
  const [colsLoaded, setColsLoaded]   = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard-cols');
      if (saved) setVisibleCols(JSON.parse(saved));
    } catch { /* ignore */ }
    setColsLoaded(true);
  }, []);

  useEffect(() => {
    if (!colsLoaded) return;
    try { localStorage.setItem('dashboard-cols', JSON.stringify(visibleCols)); } catch { /* ignore */ }
  }, [visibleCols, colsLoaded]);

  // Panel state
  const [taskNumber, setTaskNumber] = useState('');
  const [taskName, setTaskName]   = useState('');
  const [priority, setPriority]   = useState<'high' | 'low' | ''>('');
  const [dateDue, setDateDue]     = useState('');
  const [status, setStatus]       = useState<'open' | 'needs_info' | 'resolved'>('open');
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

  const openTasks = useMemo(() => {
    const priorityOrder = (t: Incident) => t.priority === 'high' ? 0 : t.priority === null ? 1 : 2;
    const byDue = (t: Incident) => t.date_due ? new Date(t.date_due).getTime() : Infinity;
    return tasks
      .filter(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'open')
      .sort((a, b) => priorityOrder(a) - priorityOrder(b) || byDue(a) - byDue(b));
  }, [tasks]);

  const needsInfoTasks = useMemo(
    () => tasks.filter(t => t.status === 'needs_info').sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );

  const completedTasks = useMemo(() => {
    let filtered = tasks.filter(t => t.status === 'resolved');
    if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);
    return filtered.sort((a, b) => b.task_number - a.task_number);
  }, [tasks, filterPriority]);

  const visibleTasks = useMemo(() => {
    if (activeView === 'open') return openTasks;
    if (activeView === 'needs_info') return needsInfoTasks;
    return completedTasks;
  }, [activeView, openTasks, needsInfoTasks, completedTasks]);

  // CSS grid template: task name is content-sized (or fills all space when 0 optional cols);
  // each optional col is preceded by a minmax(4px,1fr) spacer — spacers share remaining space
  // equally but shrink to 4px min before task name gets an ellipsis.
  const gridCols = useMemo(() => {
    const parts: string[] = [];
    if (visibleCols.requester)     parts.push('minmax(4px,1fr) minmax(0,max-content)');
    if (visibleCols.targetDate)    parts.push('minmax(4px,1fr) minmax(0,max-content)');
    if (visibleCols.dateSubmitted) parts.push('minmax(4px,1fr) minmax(0,max-content)');
    return parts.length === 0
      ? '18px 5px 1fr'
      : `18px 5px minmax(0,max-content) ${parts.join(' ')}`;
  }, [visibleCols]);

  function resetPanel() {
    setTaskNumber('');
    setTaskName('');
    setPriority('');
    setDateDue('');
    setStatus('open');
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
    const raw = task.status;
    const s = (raw === 'pending' || raw === 'in_progress' || raw === 'open') ? 'open'
            : raw === 'needs_info' ? 'needs_info'
            : 'resolved';
    setStatus(s);
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
      const found = tasks.find(t => t.task_number === num);
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

  // Suppress unused variable warnings for voice state no longer rendered in right panel
  void numRecRef; void parseSpokenNumber; void listeningNum; void setListeningNum;
  void nameRecRef; void listeningName; void setListeningName;
  void dateRecRef; void listeningDate; void setListeningDate; void parseSpokenDate;
  void requesterRecRef; void listeningRequester; void setListeningRequester;
  void infoRequiredRecRef; void listeningInfoRequired; void setListeningInfoRequired;
  void infoDoneRecRef; void listeningInfoDone; void setListeningInfoDone;
  void issuesRecRef; void listeningIssues; void setListeningIssues;
  void clearLastVoiceFieldRef; void handleVoiceCommand;

  const isOnboarding = selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding';
  const hideInfoDone = !isOnboarding && (aiStage === 'fix' || aiStage === 'recommendation');

  // ── Dark panel style constants ──────────────────────────────────────────
  const dpLabel: React.CSSProperties = {
    fontSize: '10px', fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#a8b8c8',
  };
  const dpInput: React.CSSProperties = {
    fontSize: '12px', color: '#eef2f7', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,184,200,0.15)', borderRadius: '5px',
    padding: '7px 10px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%',
  };
  const dpSelect: React.CSSProperties = {
    fontSize: '12px', color: '#eef2f7', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,184,200,0.15)', borderRadius: '5px',
    padding: '7px 10px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%', cursor: 'pointer',
  };
  const dpTextarea: React.CSSProperties = {
    fontSize: '12px', color: '#eef2f7', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,184,200,0.15)', borderRadius: '5px',
    padding: '7px 10px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%', resize: 'none', lineHeight: 1.5,
  };
  // Admin fields — compact, muted (supporting context)
  const dpAdminLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#a8b8c8',
  };
  const dpAdminInput: React.CSSProperties = {
    fontSize: '11px', color: '#eef2f7', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,184,200,0.15)', borderRadius: '4px',
    padding: '5px 8px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%',
  };
  const dpAdminSelect: React.CSSProperties = {
    fontSize: '11px', color: '#eef2f7', background: '#1a2840',
    border: '1px solid rgba(168,184,200,0.15)', borderRadius: '4px',
    padding: '5px 8px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%', cursor: 'pointer', colorScheme: 'dark',
  };
  // Work fields — prominent (primary content)
  const dpWorkLabel: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#4f8ef7',
  };
  const dpWorkTextarea: React.CSSProperties = {
    fontSize: '13px', color: '#ffffff', background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(79,142,247,0.25)', borderRadius: '6px',
    padding: '10px 12px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', width: '100%', resize: 'none', lineHeight: 1.55,
  };
  const dpAiCard: React.CSSProperties = {
    border: '1px solid rgba(79,142,247,0.25)', borderRadius: '8px',
    background: '#192840', padding: '14px',
  };
  const dpAiHeader: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid rgba(79,142,247,0.12)',
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1923" }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[600px_1fr] gap-6 items-start">

        {/* Left panel — dark navy tabbed task list */}
        <div
          className="rounded-xl overflow-hidden flex flex-col"
          style={{
            background: '#0f1923',
            border: '1px solid rgba(168,184,200,0.15)',
            fontFamily: "'DM Sans', sans-serif",
            minHeight: '600px',
          }}
        >
          {/* View tabs */}
          <div style={{ display: 'flex', padding: '10px 16px 0', gap: '2px' }}>
            {(['open', 'needs_info', 'completed'] as const).map(view => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                style={{
                  flex: 1, padding: '7px 4px',
                  border: 'none', background: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px', fontWeight: 500,
                  color: activeView === view ? '#4f8ef7' : '#a8b8c8',
                  borderBottom: `2px solid ${activeView === view ? '#4f8ef7' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {view === 'open' ? 'Open' : view === 'needs_info' ? 'Needs info' : 'Completed'}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px 9px', borderBottom: '1px solid rgba(168,184,200,0.15)', position: 'relative' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#a8b8c8' }}>
              {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
            </span>
            {/* Right-side controls */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Column picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowColPicker(v => !v)}
                  title="Choose columns"
                  style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '10px', cursor: 'pointer', border: '1px solid rgba(168,184,200,0.28)', background: showColPicker ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', color: showColPicker ? '#eef2f7' : '#a8b8c8', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                  Columns
                </button>
                {showColPicker && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowColPicker(false)} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#1a2535', border: '1px solid rgba(168,184,200,0.2)', borderRadius: '6px', padding: '8px 10px', zIndex: 100, minWidth: '150px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                      {([
                        { key: 'requester',     label: 'Requester' },
                        { key: 'targetDate',    label: 'Date' },
                        { key: 'dateSubmitted', label: 'Date submitted' },
                      ] as const).map(col => (
                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer', fontSize: '11px', color: '#a8b8c8', fontFamily: "'DM Sans', sans-serif" }}>
                          <input
                            type="checkbox"
                            checked={visibleCols[col.key]}
                            onChange={e => setVisibleCols(prev => ({ ...prev, [col.key]: e.target.checked }))}
                            style={{ cursor: 'pointer', accentColor: '#4f8ef7' }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Add task button — Open tab only */}
              {activeView === 'open' && (
                <button
                  onClick={() => { setShowAddModal(true); setNewTaskName(''); setNewTaskDetails(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', background: '#4f8ef7', color: '#fff', fontSize: '11px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  + Add task
                </button>
              )}
            </div>
          </div>

          {/* Filter bar — Completed tab only */}
          {activeView === 'completed' && (
            <div style={{ display: 'flex', gap: '6px', padding: '8px 16px', borderBottom: '1px solid rgba(168,184,200,0.15)', flexWrap: 'wrap' }}>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                style={{
                  padding: '3px 22px 3px 9px', borderRadius: '4px',
                  fontSize: '11px', border: '1px solid rgba(168,184,200,0.28)',
                  background: 'none', color: '#6b7d8f', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' fill='none'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%236b7d8f' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center',
                }}
              >
                <option value="">All urgency</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}

          {/* Task grid — all cells are direct grid children; columns auto-size together */}
          <div style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>
            {visibleTasks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', color: '#3a4a5c', fontSize: '12px' }}>
                No tasks
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignContent: 'start', fontFamily: "'DM Sans', sans-serif" }}>

                {/* ── Header cells (sticky) ── */}
                {/* # */}
                <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 4px 3px 16px', borderBottom: '1px solid rgba(168,184,200,0.1)' }} />
                {/* dot */}
                <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 8px 3px 4px', borderBottom: '1px solid rgba(168,184,200,0.1)' }} />
                {/* task name */}
                <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 8px 3px', borderBottom: '1px solid rgba(168,184,200,0.1)', fontSize: '9px', color: '#a8b8c8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>Task</div>
                {/* optional header: requester */}
                {visibleCols.requester && <>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', borderBottom: '1px solid rgba(168,184,200,0.1)' }} />
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 16px 3px', borderBottom: '1px solid rgba(168,184,200,0.1)', fontSize: '9px', color: '#a8b8c8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', textAlign: 'right' }}>Requester</div>
                </>}
                {/* optional header: due */}
                {visibleCols.targetDate && <>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', borderBottom: '1px solid rgba(168,184,200,0.1)' }} />
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 16px 3px', borderBottom: '1px solid rgba(168,184,200,0.1)', fontSize: '9px', color: '#a8b8c8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', textAlign: 'right' }}>Due</div>
                </>}
                {/* optional header: submitted */}
                {visibleCols.dateSubmitted && <>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', borderBottom: '1px solid rgba(168,184,200,0.1)' }} />
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(15,25,35,0.97)', padding: '4px 16px 3px', borderBottom: '1px solid rgba(168,184,200,0.1)', fontSize: '9px', color: '#a8b8c8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', textAlign: 'right' }}>Submitted</div>
                </>}

                {/* ── Data rows ── */}
                {visibleTasks.map(task => {
                  const isSelected = selectedTask?.id === task.id;
                  const isHovered  = hoveredId === task.id;
                  const rowBg = isSelected ? 'rgba(79,142,247,0.1)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent';
                  const cell: React.CSSProperties = { background: rowBg, cursor: 'pointer', transition: 'background 0.1s', display: 'flex', alignItems: 'center' };
                  const enter = () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); setHoveredId(task.id); };
                  const leave = () => { hoverTimerRef.current = setTimeout(() => setHoveredId(id => id === task.id ? null : id), 30); };
                  const click = () => loadTask(task);
                  return (
                    <Fragment key={task.id}>
                      {/* # */}
                      <div style={{ ...cell, padding: '5px 4px 5px 14px', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#7a8fa3', justifyContent: 'flex-end', whiteSpace: 'nowrap', borderLeft: isSelected ? '2px solid #4f8ef7' : '2px solid transparent' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                        {task.task_number}
                      </div>
                      {/* dot */}
                      <div style={{ ...cell, padding: '5px 8px 5px 4px' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', display: 'inline-block', background: task.priority === 'high' ? '#ff4444' : task.priority === 'low' ? '#22cc6e' : '#3a4a5c' }} />
                      </div>
                      {/* task name — must be display:block (not flex) for text-overflow:ellipsis */}
                      <div style={{ background: rowBg, cursor: 'pointer', transition: 'background 0.1s', padding: '5px 8px', fontSize: '12px', color: '#eef2f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                        {task.title || task.description}
                      </div>
                      {/* optional: requester */}
                      {visibleCols.requester && <>
                        <div style={cell} onClick={click} onMouseEnter={enter} onMouseLeave={leave} />
                        <div style={{ ...cell, padding: '5px 16px', fontSize: '10px', color: task.reported_by ? '#eef2f7' : '#3a4a5c', justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                          {task.reported_by ?? '—'}
                        </div>
                      </>}
                      {/* optional: due */}
                      {visibleCols.targetDate && <>
                        <div style={cell} onClick={click} onMouseEnter={enter} onMouseLeave={leave} />
                        <div style={{ ...cell, padding: '5px 16px', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: task.date_due ? '#a8b8c8' : '#3a4a5c', justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                          {task.date_due ? formatDate(task.date_due) : '—'}
                        </div>
                      </>}
                      {/* optional: submitted */}
                      {visibleCols.dateSubmitted && <>
                        <div style={cell} onClick={click} onMouseEnter={enter} onMouseLeave={leave} />
                        <div style={{ ...cell, padding: '5px 16px', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#a8b8c8', justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={click} onMouseEnter={enter} onMouseLeave={leave}>
                          {formatDate(task.created_at)}
                        </div>
                      </>}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — dark detail panel */}
        <div className="lg:sticky lg:top-4">
          <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{ background: '#141f2d', border: '1px solid rgba(168,184,200,0.15)', fontFamily: "'DM Sans', sans-serif", minHeight: '600px' }}
          >

            {/* ── Header strip ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 20px 10px', borderBottom: '1px solid rgba(168,184,200,0.15)', flexShrink: 0, minHeight: '46px' }}>
              {taskNumber && (
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                  #{taskNumber}
                </span>
              )}
              {/* Auto-sizing input: hidden mirror span sets the width; input overlays it */}
              <div style={{ position: 'relative', minWidth: '12ch', maxWidth: '100%' }}>
                <span aria-hidden style={{ display: 'block', visibility: 'hidden', fontSize: '15px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'pre', padding: 0, lineHeight: '1.4' }}>
                  {taskName || (selectedTask ? '\u00a0' : 'Select a task from the list \u2192')}
                </span>
                <input
                  value={taskName}
                  onChange={e => { setTaskName(e.target.value); markDirty(); }}
                  readOnly={!selectedTask}
                  placeholder={selectedTask ? '' : 'Select a task from the list →'}
                  className="rp-task-input"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', fontSize: '15px', fontWeight: 600, color: '#ffffff', background: 'none', border: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif", padding: 0 }}
                />
              </div>
              <VoiceButton
                listening={listeningName}
                onToggle={() => listeningName
                  ? stopVoice(nameRecRef, setListeningName)
                  : startVoice(wrapVoiceResult(t => { setTaskName(t); markDirty(); }, () => setTaskName('')), setListeningName, nameRecRef, false)
                }
              />
            </div>

            {/* ── Scrollable body ───────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <>

                {/* ── Admin fields — compact, muted (supporting context) ── */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(168,184,200,0.07)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
                    {/* Row 1: Status, Priority, Task Type */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Status</label>
                      <select value={status} onChange={e => { setStatus(e.target.value as 'open' | 'needs_info' | 'resolved'); markDirty(); }} style={dpAdminSelect}>
                        <option value="open">Open</option>
                        <option value="needs_info">Needs info</option>
                        <option value="resolved">Completed</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Priority</label>
                      <select value={priority} onChange={e => { setPriority(e.target.value as 'high' | 'low' | ''); markDirty(); }} style={dpAdminSelect}>
                        <option value="">—</option>
                        <option value="high">High</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Task type</label>
                      <select value={selectedType} onChange={e => selectProblemType(e.target.value)} style={dpAdminSelect}>
                        {QUICK_TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    {/* Row 2: Assigned To, Requester, Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Assigned to</label>
                      <select value={assignedTo} onChange={e => { setAssignedTo(e.target.value); markDirty(); }} style={dpAdminSelect}>
                        <option value="">Unassigned</option>
                        <option value="Bruce">Bruce</option>
                        <option value="John">John</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Requester</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input value={requester} onChange={e => { setRequester(e.target.value); markDirty(); }} style={{ ...dpAdminInput, flex: 1 }} />
                        <VoiceButton
                          listening={listeningRequester}
                          onToggle={() => listeningRequester
                            ? stopVoice(requesterRecRef, setListeningRequester)
                            : startVoice(wrapVoiceResult(t => { setRequester(t); markDirty(); }, () => setRequester('')), setListeningRequester, requesterRecRef, false)
                          }
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Date</label>
                      <input type="date" value={dateDue} onChange={e => { setDateDue(e.target.value); markDirty(); }} style={dpAdminInput} />
                    </div>
                  </div>
                  {/* Onboarding: Information needed lives in admin context */}
                  {isOnboarding && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={dpAdminLabel}>Information needed</label>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2px' }}>
                        <AutoTextarea
                          style={{ ...dpAdminInput, resize: 'none' as const, lineHeight: 1.5, flex: 1 }}
                          value={infoRequired}
                          onChange={e => setInfoRequired(e.target.value)}
                          onBlur={() => saveUpdate('details', infoRequired, savedDetailsRef)}
                          placeholder="What information is needed or what does the checklist say..."
                        />
                        <VoiceButton
                          listening={listeningInfoRequired}
                          onToggle={() => listeningInfoRequired
                            ? stopVoice(infoRequiredRecRef, setListeningInfoRequired)
                            : startVoice(wrapVoiceResult(t => setInfoRequired(prev => prev ? `${prev} ${t}` : t), () => setInfoRequired('')), setListeningInfoRequired, infoRequiredRecRef, true)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Work section — primary content ── */}

                {/* Onboarding: infoDone + Ask the AI + asset proposals */}
                {isOnboarding && (<>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={dpWorkLabel}>Information to send to the AI</label>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <AutoTextarea
                      style={{ ...dpWorkTextarea, flex: 1 }}
                      value={infoDone}
                      onChange={e => setInfoDone(e.target.value)}
                      onBlur={() => saveUpdate('progress', infoDone, savedInfoDoneRef)}
                      placeholder="What information was gathered or what actions were taken..."
                    />
                    <VoiceButton
                      listening={listeningInfoDone}
                      onToggle={() => listeningInfoDone
                        ? stopVoice(infoDoneRecRef, setListeningInfoDone)
                        : startVoice(wrapVoiceResult(t => setInfoDone(prev => prev ? `${prev} ${t}` : t), () => setInfoDone('')), setListeningInfoDone, infoDoneRecRef, true)
                      }
                    />
                    </div>
                    {diagStage === 'idle' && (
                      <button
                        style={{ marginTop: '4px', padding: '8px 16px', borderRadius: '6px', background: '#4f8ef7', color: '#fff', border: 'none', cursor: diagnosing ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500, opacity: diagnosing ? 0.7 : 1 }}
                        onClick={handleDiagnose}
                        disabled={diagnosing}
                      >
                        {diagnosing && <span className="spinner spinner-sm mr-1" />}
                        {diagnosing ? 'Thinking…' : 'Ask the AI'}
                      </button>
                    )}
                  </div>
                  {/* Onboarding asset proposals */}
                  {diagStage === 'cause' && onboardingData && (
                  <div style={dpAiCard}>
                    <div style={dpAiHeader}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f8ef7', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#4f8ef7', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>IT Buddy</span>
                    </div>
                    <div style={{ padding: '14px' }} className="space-y-4">

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
                </>)}

                {/* ── Working area: Problem to fix + AI ── */}
                {!isOnboarding && (
                  <div style={{ borderLeft: '3px solid #4f8ef7', borderRadius: '6px', background: 'rgba(79,142,247,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Problem to fix (hidden once AI reaches fix/recommendation) */}
                    {!hideInfoDone && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={dpWorkLabel}>Problem to fix</label>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <AutoTextarea
                            style={{ ...dpWorkTextarea, flex: 1 }}
                            value={infoDone}
                            onChange={e => { setInfoDone(e.target.value); markDirty(); }}
                            onBlur={() => saveUpdate('progress', infoDone, savedInfoDoneRef)}
                            placeholder="Describe the problem..."
                          />
                          <VoiceButton
                            listening={listeningInfoDone}
                            onToggle={() => listeningInfoDone
                              ? stopVoice(infoDoneRecRef, setListeningInfoDone)
                              : startVoice(wrapVoiceResult(t => setInfoDone(prev => prev ? `${prev} ${t}` : t), () => setInfoDone('')), setListeningInfoDone, infoDoneRecRef, true)
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* AI card */}
                    <div style={dpAiCard}>
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
                    </div>
                  </div>
                )}

                {/* Issues / Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={dpLabel}>Issues / Comments</label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <AutoTextarea
                      style={{ ...dpTextarea, flex: 1 }}
                      value={issues}
                      onChange={e => setIssues(e.target.value)}
                      onBlur={() => saveUpdate('progress', issues.trim() ? `Issues/Comments: ${issues.trim()}` : '', savedIssuesRef)}
                      placeholder="Any issues or comments..."
                    />
                    <VoiceButton
                      listening={listeningIssues}
                      onToggle={() => listeningIssues
                        ? stopVoice(issuesRecRef, setListeningIssues)
                        : startVoice(wrapVoiceResult(t => setIssues(prev => prev ? `${prev} ${t}` : t), () => setIssues('')), setListeningIssues, issuesRecRef, true)
                      }
                    />
                  </div>
                </div>

                {/* Delete — muted, bottom of panel */}
                <div style={{ paddingTop: '4px', textAlign: 'right' }}>
                  <button
                    onClick={handleDelete}
                    style={{ fontSize: '11px', color: '#3a4a5c', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e85c5c'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3a4a5c'; }}
                  >
                    Delete this task
                  </button>
                </div>

              </>

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

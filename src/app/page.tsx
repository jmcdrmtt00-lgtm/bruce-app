'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident } from '@/types';
import { PROBLEM_TYPES, QUICK_TASK_TYPES } from '@/data/problemTypes';

const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-error',
  low:  'badge-success',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'H', low: 'L',
};

function normalizeScreenToTypeId(screen: string): string {
  if (!screen) return '';
  if (PROBLEM_TYPES[screen]) return screen;
  const lower = screen.toLowerCase().replace(/[\s-]/g, '_');
  if (PROBLEM_TYPES[lower]) return lower;
  return '';
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
      <table className="table table-xs table-fixed bg-base-100 w-full">
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
              className="hover cursor-pointer [&>td]:py-0.5"
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

  // Add task modal state
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [newTaskName,    setNewTaskName]    = useState('');
  const [newTaskStatus,  setNewTaskStatus]  = useState<'pending' | 'in_progress'>('pending');
  const [newTaskDetails, setNewTaskDetails] = useState('');
  const [infoRequired, setInfoRequired] = useState('');
  const [infoDone, setInfoDone]         = useState('');
  const [issues, setIssues]             = useState('');
  const [selectedTask, setSelectedTask] = useState<Incident | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Problem type state
  const [problemTypeInput, setProblemTypeInput] = useState('');
  const [matchedTypes,     setMatchedTypes]     = useState<string[]>([]);
  const [selectedType,     setSelectedType]     = useState<string | null>(null);
  const [matching,         setMatching]         = useState(false);
  const [diagnosing,       setDiagnosing]       = useState(false);
  const [diagStage,        setDiagStage]        = useState<'idle' | 'questions' | 'cause' | 'fix'>('idle');
  const [diagCause,        setDiagCause]        = useState<string | null>(null);
  const [diagDetail,       setDiagDetail]       = useState<string | null>(null);
  const [diagDetailOpen,   setDiagDetailOpen]   = useState(false);
  const [diagQuestions,    setDiagQuestions]    = useState<string[] | null>(null);
  const [diagSteps,        setDiagSteps]        = useState<string[] | null>(null);
  const [diagConversation, setDiagConversation] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [diagAnswer,       setDiagAnswer]       = useState('');

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
  const [listeningProblemType,  setListeningProblemType]  = useState(false);
  const [listeningInfoRequired, setListeningInfoRequired] = useState(false);
  const [listeningInfoDone,     setListeningInfoDone]     = useState(false);
  const [listeningIssues,       setListeningIssues]       = useState(false);

  const numRecRef           = useRef<unknown>(null);
  const nameRecRef          = useRef<unknown>(null);
  const dateRecRef          = useRef<unknown>(null);
  const problemTypeRecRef   = useRef<unknown>(null);
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
            body: JSON.stringify({ title: taskName.trim() || null, priority: priority || null, screen: selectedType || null, status, date_due: dateDue || null }),
          });
          loadTasks();
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('idle'); }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskName, priority, dateDue, status, selectedType]);

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

  async function saveAiUpdate(type: 'ai_response' | 'user_reply', note: string) {
    if (!selectedTask || !note.trim()) return;
    try {
      await fetch(`/api/issues/${selectedTask.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note: note.trim() }),
      });
    } catch { /* ignore */ }
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
    setInfoRequired('');
    setInfoDone('');
    setIssues('');
    setSelectedTask(null);
    setProblemTypeInput('');
    setMatchedTypes([]);
    setSelectedType(null);
    setDiagStage('idle');
    setDiagCause(null);
    setDiagDetail(null);
    setDiagDetailOpen(false);
    setDiagQuestions(null);
    setDiagSteps(null);
    setDiagConversation([]);
    setDiagAnswer('');
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

    // Normalize screen → problem type ID
    const rawScreen = task.screen || '';
    const typeId = normalizeScreenToTypeId(rawScreen);
    setSelectedType(typeId || null);
    setProblemTypeInput(typeId ? (PROBLEM_TYPES[typeId]?.label ?? rawScreen) : rawScreen);
    setMatchedTypes([]);

    setInfoDone('');
    setIssues('');
    setDiagStage('idle');
    setDiagCause(null);
    setDiagDetail(null);
    setDiagDetailOpen(false);
    setDiagQuestions(null);
    setDiagSteps(null);
    setDiagConversation([]);
    setDiagAnswer('');
    setSelectedTask(task);
    panelDirtyRef.current = false;
    savedInfoReqRef.current = ''; savedInfoDoneRef.current = ''; savedIssuesRef.current = ''; savedDetailsRef.current = '';

    // Set infoRequired from type questions immediately
    if (typeId && PROBLEM_TYPES[typeId]) {
      setInfoRequired(`Information needed: ${PROBLEM_TYPES[typeId].questions.join(', ')}`);
    } else {
      setInfoRequired('');
    }

    // Load updates
    fetch(`/api/issues/${task.id}/updates`)
      .then(r => r.json())
      .then(({ updates }: { updates: { type: string; note: string; created_at?: string }[] }) => {
        const latest = (t: string) => updates.find(u => u.type === t)?.note ?? '';

        const progress = latest('progress');
        setInfoDone(progress);
        savedInfoDoneRef.current = progress;

        const details = latest('details');
        if (details) {
          setInfoRequired(details);
          savedDetailsRef.current = details;
        }

        // For onboarding without saved details, refine with actual asset number
        if (typeId === 'onboarding' && !details) {
          fetch('/api/assets/download')
            .then(r => r.json())
            .then(({ assets }: { assets: { asset_number: string | null }[] }) => {
              const nums = (assets ?? []).map(a => parseInt(a.asset_number ?? '')).filter(n => !isNaN(n));
              if (nums.length > 0) {
                const next = String(Math.max(...nums) + 1).padStart(4, '0');
                const pt = PROBLEM_TYPES['onboarding'];
                if (pt) {
                  const updatedQ = pt.questions.map(q => q === 'Next asset #?' ? `Next asset #${next}?` : q);
                  setInfoRequired(`Information needed: ${updatedQ.join(', ')}`);
                }
              }
            })
            .catch(() => {});
        }
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
    const pt = PROBLEM_TYPES[id];
    if (!pt) return;

    setInfoRequired(`Information needed: ${pt.questions.join(', ')}`);

    if (id === 'onboarding') {
      fetch('/api/assets/download')
        .then(r => r.json())
        .then(({ assets }: { assets: { asset_number: string | null }[] }) => {
          const nums = (assets ?? []).map(a => parseInt(a.asset_number ?? '')).filter(n => !isNaN(n));
          if (nums.length > 0) {
            const next = String(Math.max(...nums) + 1).padStart(4, '0');
            const updatedQ = pt.questions.map(q => q === 'Next asset #?' ? `Next asset #${next}?` : q);
            setInfoRequired(`Information needed: ${updatedQ.join(', ')}`);
          }
        })
        .catch(() => {});
    }

    markDirty();
  }

  async function handleMatchProblemType() {
    if (!problemTypeInput.trim()) return;

    // Direct match: if input already equals a known ID or label, skip the API call
    const inputLower = problemTypeInput.trim().toLowerCase();
    const directMatch = Object.entries(PROBLEM_TYPES).find(
      ([id, { label }]) => id === inputLower || label.toLowerCase() === inputLower
    );
    if (directMatch) {
      setMatchedTypes([directMatch[0]]);
      selectProblemType(directMatch[0]);
      return;
    }

    setMatching(true);
    setMatchedTypes([]);
    setSelectedType(null);
    setDiagStage('idle');
    setDiagCause(null);
    setDiagDetail(null);
    setDiagDetailOpen(false);
    setDiagQuestions(null);
    setDiagSteps(null);
    setDiagConversation([]);
    setDiagAnswer('');
    try {
      const res = await fetch('/api/ai/match-problem-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: problemTypeInput,
          problem_types: Object.entries(PROBLEM_TYPES).map(([id, { label }]) => `${id}: ${label}`),
        }),
      });
      const data = await res.json();
      const matches: string[] = data.matches ?? [];
      setMatchedTypes(matches);
      if (matches.length === 0) {
        toast.error("No matching problem type found. Try describing the problem differently.");
      } else if (matches.length === 1) {
        selectProblemType(matches[0]);
      }
      // If multiple matches: show button group, user picks one
    } catch {
      toast.error('Could not match problem type — try again.');
    }
    setMatching(false);
  }

  async function handleDiagnose() {
    if (!selectedType) return;

    // Onboarding: use AI to extract structured data, then navigate to form
    if (selectedType === 'onboarding') {
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
          router.push('/onboarding');
          return;
        }
      } catch {
        toast.error('Could not get AI response — try again.');
      }
      setDiagnosing(false);
      return;
    }

    // Stage 1: symptoms → cause or questions
    setDiagnosing(true);
    setDiagStage('idle');
    setDiagCause(null);
    setDiagDetail(null);
    setDiagDetailOpen(false);
    setDiagQuestions(null);
    setDiagSteps(null);
    setDiagConversation([]);
    setDiagAnswer('');

    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_type: selectedType,
          stage: 'symptoms',
          task_details: infoRequired || null,
          information: infoDone || null,
        }),
      });
      const data = await res.json();
      const symptoms = [infoRequired, infoDone].filter(Boolean).join('\n') || 'No symptoms provided.';
      const userTurn = { role: 'user' as const, content: `Symptoms: ${symptoms}` };

      if (data.cause) {
        const aiTurn = { role: 'ai' as const, content: data.cause };
        setDiagConversation([userTurn, aiTurn]);
        setDiagCause(data.cause);
        setDiagDetail(data.detail ?? null);
        setDiagDetailOpen(false);
        setDiagStage('cause');
        await saveAiUpdate('ai_response', `Cause: ${data.cause}`);
      } else if (data.questions?.length) {
        const aiTurn = { role: 'ai' as const, content: data.questions.join('\n') };
        setDiagConversation([userTurn, aiTurn]);
        setDiagQuestions(data.questions);
        setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
        await saveAiUpdate('ai_response', `Questions: ${(data.questions as string[]).join(' | ')}`);
      }
    } catch {
      toast.error('Could not get AI response — try again.');
    }
    setDiagnosing(false);
  }

  async function handleFollowUp() {
    if (!diagAnswer.trim() || !selectedType) return;
    const answer = diagAnswer.trim();
    setDiagAnswer('');
    await saveAiUpdate('user_reply', answer);

    const userTurn = { role: 'user' as const, content: answer };
    const updatedConv = [...diagConversation, userTurn];
    setDiagConversation(updatedConv);

    setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_type: selectedType,
          stage: 'followup',
          conversation: updatedConv,
        }),
      });
      const data = await res.json();

      if (data.cause) {
        const aiTurn = { role: 'ai' as const, content: data.cause };
        setDiagConversation(prev => [...prev, aiTurn]);
        setDiagCause(data.cause);
        setDiagDetail(data.detail ?? null);
        setDiagDetailOpen(false);
        setDiagStage('cause');
        await saveAiUpdate('ai_response', `Cause: ${data.cause}`);
      } else if (data.questions?.length) {
        const aiTurn = { role: 'ai' as const, content: (data.questions as string[]).join('\n') };
        setDiagConversation(prev => [...prev, aiTurn]);
        setDiagQuestions(data.questions);
        setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
        await saveAiUpdate('ai_response', `Questions: ${(data.questions as string[]).join(' | ')}`);
      }
    } catch {
      toast.error('Could not get AI response — try again.');
    }
    setDiagnosing(false);
  }

  async function handleConfirmCause() {
    if (!diagCause || !selectedType) return;
    setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_type: selectedType,
          stage: 'fix',
          information: diagCause,
        }),
      });
      const data = await res.json();
      const steps: string[] = data.steps ?? [];
      setDiagSteps(steps);
      setDiagStage('fix');
      await saveAiUpdate('ai_response', `Fix steps: ${steps.join(' | ')}`);
    } catch {
      toast.error('Could not get fix steps — try again.');
    }
    setDiagnosing(false);
  }

  async function handleAddTask() {
    if (!newTaskName.trim()) return;
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskName.trim(), status: newTaskStatus }),
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
        setNewTaskName('');
        setNewTaskStatus('pending');
        setNewTaskDetails('');
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
            <button
              className="btn btn-outline btn-sm w-full mt-2"
              onClick={handleSeedData}
              disabled={seeding}
            >
              {seeding ? <span className="loading loading-spinner loading-sm" /> : 'Load Demo Data'}
            </button>
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
                  onClick={() => { setShowAddModal(true); setNewTaskName(''); setNewTaskStatus('pending'); setNewTaskDetails(''); }}
                >
                  + Add task
                </button>
                {selectedTask && (
                  <button className="btn btn-ghost btn-xs text-base-content/40" onClick={resetPanel}>
                    clear
                  </button>
                )}
              </div>

              {/* Empty state hint */}
              {!selectedTask && (
                <p className="text-center text-base-content/40 text-sm py-4">Select a task to edit it</p>
              )}

              {/* Task fields — only shown when a task is selected */}
              {selectedTask && (<>
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

              {/* Status */}
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
                  <button
                    className={`btn btn-xs flex-1 ${status === 'resolved' ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => { setStatus('resolved'); markDirty(); }}
                  >
                    Complete
                  </button>
                </div>
              </div>

              {/* Task type */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Task type</span>
                </label>
                <div className="flex gap-1 items-start">
                  <select
                    className="select select-bordered select-sm text-sm"
                    value={QUICK_TASK_TYPES.some(t => t.id === selectedType) ? selectedType ?? '' : ''}
                    onChange={e => { if (e.target.value) selectProblemType(e.target.value); else { setSelectedType(null); setMatchedTypes([]); } }}
                  >
                    <option value="">Type…</option>
                    {QUICK_TASK_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    value={problemTypeInput}
                    onChange={e => {
                      setProblemTypeInput(e.target.value);
                      setSelectedType(null);
                      setMatchedTypes([]);
                    }}
                    placeholder="Describe the problem to identify its type..."
                  />
                  <VoiceButton
                    listening={listeningProblemType}
                    onToggle={() => listeningProblemType
                      ? stopVoice(problemTypeRecRef as React.MutableRefObject<unknown>, setListeningProblemType)
                      : startVoice(
                          wrapVoiceResult(
                            text => setProblemTypeInput(prev => prev ? `${prev} ${text}` : text),
                            () => setProblemTypeInput('')
                          ),
                          setListeningProblemType,
                          problemTypeRecRef as React.MutableRefObject<unknown>,
                          true
                        )
                    }
                  />
                </div>

                <button
                  className="btn btn-outline btn-sm mt-1 w-full"
                  onClick={handleMatchProblemType}
                  disabled={matching || !problemTypeInput.trim()}
                >
                  {matching && <span className="loading loading-spinner loading-xs" />}
                  {matching ? 'Matching…' : 'Match'}
                </button>

                {/* Multiple matches — user picks one */}
                {matchedTypes.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {matchedTypes.map(id => (
                      <button
                        key={id}
                        className={`btn btn-xs ${selectedType === id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => selectProblemType(id)}
                      >
                        {PROBLEM_TYPES[id]?.label ?? id}
                      </button>
                    ))}
                  </div>
                )}

              </div>

              {/* Task details */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Task details</span>
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
              </div>

              {/* Information to send to the AI */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Information to send to the AI</span>
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
                {/* Ask the AI button */}
                {selectedType && (
                  <button
                    className="btn btn-primary btn-sm mt-2 w-full"
                    onClick={handleDiagnose}
                    disabled={diagnosing}
                  >
                    {diagnosing && <span className="loading loading-spinner loading-xs" />}
                    {diagnosing
                      ? 'Thinking…'
                      : `Ask the AI to help with ${PROBLEM_TYPES[selectedType]?.label ?? selectedType}`}
                  </button>
                )}
              </div>

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

              {/* IT Buddy response panel */}
              {diagStage !== 'idle' && (
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">IT Buddy</span>
                  </label>

                  {/* Questions stage */}
                  {diagStage === 'questions' && diagQuestions && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-xs font-semibold text-base-content/50">To narrow down the cause, please answer:</p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {diagQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ol>
                      <AutoTextarea
                        className="textarea textarea-bordered textarea-sm w-full text-sm font-mono"
                        value={diagAnswer}
                        onChange={e => setDiagAnswer(e.target.value)}
                        placeholder={diagQuestions.map((_, i) => `${i + 1}. `).join('\n')}
                      />
                      <button
                        className="btn btn-outline btn-sm w-full"
                        onClick={handleFollowUp}
                        disabled={diagnosing || !diagAnswer.trim()}
                      >
                        {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
                      </button>
                    </div>
                  )}

                  {/* Cause stage */}
                  {diagStage === 'cause' && diagCause && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-sm font-medium">{diagCause}</p>
                      <div>
                        <button
                          className="text-xs text-primary underline"
                          onClick={() => setDiagDetailOpen(o => !o)}
                        >
                          {diagDetailOpen ? 'Hide detail' : 'More detail →'}
                        </button>
                        {diagDetailOpen && (
                          <p className="text-xs text-base-content/70 mt-1">{diagDetail ?? 'No additional detail available.'}</p>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          className="btn btn-primary btn-sm flex-1"
                          onClick={handleConfirmCause}
                          disabled={diagnosing}
                        >
                          {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Get fix steps'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm flex-1"
                          onClick={() => {
                            setDiagStage('questions');
                            setDiagQuestions(["What else can you tell me about the problem?"]);
                            setDiagAnswer('1. ');
                            setDiagCause(null);
                            setDiagDetail(null);
                          }}
                          disabled={diagnosing}
                        >
                          Not quite right
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fix stage */}
                  {diagStage === 'fix' && diagSteps && (
                    <div className="rounded-box p-3 bg-primary/10 space-y-2">
                      <p className="text-xs font-semibold text-base-content/50">Fix steps:</p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {diagSteps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* View details link + delete */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/issues/${selectedTask.id}`}
                  className="btn btn-ghost btn-xs gap-1 flex-1"
                >
                  <ExternalLink className="w-3 h-3" /> View full details
                </Link>
                <button
                  className="btn btn-ghost btn-xs text-base-content/25 hover:text-error hover:bg-transparent"
                  onClick={handleDelete}
                  title="Delete task"
                >
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
      {/* Add task modal */}
      {showAddModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold mb-3">Add task</h3>
            <input
              className="input input-bordered input-sm w-full mb-2"
              placeholder="Task name..."
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
            />
            <AutoTextarea
              className="textarea textarea-bordered textarea-sm w-full mb-3 text-sm"
              value={newTaskDetails}
              onChange={e => setNewTaskDetails(e.target.value)}
              placeholder="Task details..."
            />
            <div className="flex gap-1 mb-4">
              <button
                className={`btn btn-xs flex-1 ${newTaskStatus === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setNewTaskStatus('pending')}
              >
                Queue
              </button>
              <button
                className={`btn btn-xs flex-1 ${newTaskStatus === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setNewTaskStatus('in_progress')}
              >
                In Progress
              </button>
            </div>
            <div className="modal-action mt-0">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddTask} disabled={!newTaskName.trim()}>Save</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)} />
        </dialog>
      )}
    </main>
  );
}

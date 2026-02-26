'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident } from '@/types';

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
  const [saving, setSaving] = useState(false);

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
  }

  function loadTask(task: Incident) {
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
    } else if (cmd.includes('save')) {
      handleSave();
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

  async function handleSave() {
    if (mode === 'add') {
      if (!taskName.trim()) { toast.error('Task name is required'); return; }
      setSaving(true);
      try {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:    taskName.trim(),
            priority: priority || null,
            screen:   checklist || null,
            status,
            date_due: dateDue || null,
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const newId = data.incident?.id;

        // Post any non-empty text areas as updates on the new task
        if (newId) {
          if (infoRequired.trim()) {
            await fetch(`/api/issues/${newId}/updates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'approach', note: infoRequired.trim() }),
            });
          }
          if (infoDone.trim()) {
            await fetch(`/api/issues/${newId}/updates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'progress', note: infoDone.trim() }),
            });
          }
          if (issues.trim()) {
            await fetch(`/api/issues/${newId}/updates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'progress', note: `Issues/Comments: ${issues.trim()}` }),
            });
          }
        }

        toast.success('Task added!');
        resetPanel();
        loadTasks();
      } catch {
        toast.error('Failed to add task.');
      }
      setSaving(false);
    } else {
      if (!selectedTask) { toast.error('Select a task first (click a row or enter a task #).'); return; }
      setSaving(true);
      try {
        await fetch(`/api/issues/${selectedTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:    taskName.trim() || null,
            priority: priority || null,
            screen:   checklist || null,
            status,
            date_due: dateDue || null,
          }),
        });

        if (infoRequired.trim()) {
          await fetch(`/api/issues/${selectedTask.id}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'approach', note: infoRequired.trim() }),
          });
        }
        if (infoDone.trim()) {
          await fetch(`/api/issues/${selectedTask.id}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'progress', note: infoDone.trim() }),
          });
        }
        if (issues.trim()) {
          await fetch(`/api/issues/${selectedTask.id}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'progress', note: `Issues/Comments: ${issues.trim()}` }),
          });
        }

        toast.success('Task updated!');
        resetPanel();
        loadTasks();
      } catch {
        toast.error('Failed to update task.');
      }
      setSaving(false);
    }
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
                    onChange={e => setTaskName(e.target.value)}
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
                        onClick={() => setPriority(prev => prev === p ? '' : p)}
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
                      onChange={e => setDateDue(e.target.value)}
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
                      onClick={() => setStatus('pending')}
                    >
                      Queue
                    </button>
                    <button
                      className={`btn btn-xs flex-1 ${status === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setStatus('in_progress')}
                    >
                      In&nbsp;Progress
                    </button>
                    {mode === 'update' && (
                      <button
                        className={`btn btn-xs flex-1 ${status === 'resolved' ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => setStatus('resolved')}
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
                    onChange={e => setChecklist(e.target.value)}
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
                {checklist && CHECKLIST_ROUTES[checklist] && (
                  <Link
                    href={CHECKLIST_ROUTES[checklist]}
                    className="inline-flex items-center gap-1 text-sm underline text-primary hover:text-primary-focus mb-1 w-fit ml-2"
                  >
                    {checklist}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
                <div className="flex gap-1 items-start">
                  <textarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    rows={3}
                    value={infoRequired}
                    onChange={e => setInfoRequired(e.target.value)}
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
                  <textarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    rows={3}
                    value={infoDone}
                    onChange={e => setInfoDone(e.target.value)}
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
              </div>

              {/* Issues / Comments */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Issues / Comments</span>
                </label>
                <div className="flex gap-1 items-start">
                  <textarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                    rows={3}
                    value={issues}
                    onChange={e => setIssues(e.target.value)}
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

              {/* Save */}
              <button
                className="btn btn-primary btn-sm w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
              </button>

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

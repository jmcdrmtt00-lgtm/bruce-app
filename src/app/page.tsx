'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Mic, MicOff, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident } from '@/types';

const PRIORITY_BADGE: Record<string, string> = {
  high:   'badge-error',
  medium: 'badge-warning',
  low:    'badge-info',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'H', medium: 'M', low: 'L',
};

function TaskTable({
  tasks,
  onRowClick,
}: {
  tasks: Incident[];
  onRowClick: (task: Incident) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="card bg-base-100 shadow p-4 text-center text-base-content/40 text-sm">
        No tasks
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-box shadow">
      <table className="table table-sm bg-base-100 w-full">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Name</th>
            <th>Priority</th>
            <th>Screen</th>
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
                <p className="max-w-[220px] truncate font-medium text-sm">
                  {task.title || task.description.slice(0, 60)}
                </p>
              </td>
              <td>
                {task.priority && (
                  <span className={`badge badge-sm ${PRIORITY_BADGE[task.priority]}`}>
                    {PRIORITY_LABEL[task.priority] ?? task.priority}
                  </span>
                )}
              </td>
              <td>
                {task.screen && (
                  <Link
                    href="/onboarding"
                    className="badge badge-outline badge-sm hover:badge-primary transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {task.screen}
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Panel state
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [taskNumber, setTaskNumber] = useState('');
  const [taskName, setTaskName] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | ''>('');
  const [customer, setCustomer] = useState('');
  const [screen, setScreen] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'resolved'>('pending');
  const [note, setNote] = useState('');
  const [selectedTask, setSelectedTask] = useState<Incident | null>(null);
  const [saving, setSaving] = useState(false);

  // Voice for note
  const [listeningNote, setListeningNote] = useState(false);
  const noteRecRef = useRef<unknown>(null);

  // Voice for task #
  const [listeningNum, setListeningNum] = useState(false);
  const numRecRef = useRef<unknown>(null);

  // Find Similar state
  const [simNum, setSimNum] = useState('');
  const [simName, setSimName] = useState('');
  const [simElab, setSimElab] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simResults, setSimResults] = useState<{ id: string; task_number: number; title: string; similarity: string }[]>([]);
  const [simMessage, setSimMessage] = useState('');

  const loadTasks = useCallback(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => { setTasks(data.incidents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const inProgress = useMemo(
    () => tasks.filter(t => t.status === 'in_progress').sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );
  const queue = useMemo(
    () => tasks.filter(t => t.status === 'pending' || t.status === 'open').sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );
  const allActive = useMemo(() => [...inProgress, ...queue], [inProgress, queue]);

  function resetPanel() {
    setTaskNumber('');
    setTaskName('');
    setPriority('');
    setCustomer('');
    setScreen('');
    setStatus('pending');
    setNote('');
    setSelectedTask(null);
  }

  function loadTask(task: Incident) {
    setMode('update');
    setTaskNumber(String(task.task_number));
    setTaskName(task.title || task.description);
    setPriority(task.priority || '');
    setCustomer(task.reported_by || '');
    const s = task.status === 'open' ? 'pending' : task.status;
    setStatus(s as 'pending' | 'in_progress' | 'resolved');
    setNote('');
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

  async function handleSave() {
    if (mode === 'add') {
      if (!taskName.trim()) { toast.error('Task name is required'); return; }
      setSaving(true);
      try {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:       taskName.trim(),
            reported_by: customer.trim() || null,
            priority:    priority || null,
            screen:      screen   || null,
            status,
          }),
        });
        if (!res.ok) throw new Error();
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
            title:       taskName.trim() || null,
            reported_by: customer.trim() || null,
            priority:    priority || null,
            status,
          }),
        });
        if (note.trim()) {
          const updateType = status === 'resolved' ? 'resolved' : 'progress';
          await fetch(`/api/issues/${selectedTask.id}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: updateType, note: note.trim() }),
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

  async function handleFindSimilar() {
    if (!simName.trim()) { toast.error('Enter a task name to search.'); return; }
    setSimLoading(true);
    setSimResults([]);
    setSimMessage('');
    try {
      const res = await fetch('/api/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: simName.trim(), elaboration: simElab.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSimMessage(data.error || 'Search failed.'); }
      else {
        setSimResults(data.results ?? []);
        if ((data.results ?? []).length === 0) setSimMessage(data.message || 'No similar tasks found.');
      }
    } catch {
      setSimMessage('Search failed.');
    }
    setSimLoading(false);
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
    <main className="min-h-screen bg-base-200 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_360px] gap-4 items-start">

        {/* In Progress */}
        <div>
          <div className="stats bg-base-100 shadow w-full mb-3">
            <div className="stat py-3">
              <div className="stat-title text-sm">In Progress</div>
              <div className="stat-value text-2xl text-warning">{inProgress.length}</div>
            </div>
          </div>
          <TaskTable tasks={inProgress} onRowClick={loadTask} />
        </div>

        {/* Queue */}
        <div>
          <div className="stats bg-base-100 shadow w-full mb-3">
            <div className="stat py-3">
              <div className="stat-title text-sm">Queue</div>
              <div className="stat-value text-2xl text-info">{queue.length}</div>
            </div>
          </div>
          <TaskTable tasks={queue} onRowClick={loadTask} />
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
                  <button
                    className={`btn btn-sm ${listeningNum ? 'btn-error' : 'btn-outline'}`}
                    title="Say task number"
                    onClick={() => listeningNum
                      ? stopVoice(numRecRef as React.MutableRefObject<unknown>, setListeningNum)
                      : startVoice(
                          text => handleTaskNumberInput(parseSpokenNumber(text)),
                          setListeningNum,
                          numRecRef as React.MutableRefObject<unknown>,
                          false
                        )
                    }
                  >
                    {listeningNum ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Task Name */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">
                    Task Name{mode === 'add' ? ' *' : ''}
                  </span>
                </label>
                <input
                  className="input input-bordered input-sm w-full"
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                  placeholder={mode === 'add' ? 'Describe the task...' : ''}
                />
              </div>

              {/* Priority */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Priority</span>
                </label>
                <div className="flex gap-1">
                  {(['high', 'medium', 'low'] as const).map(p => (
                    <button
                      key={p}
                      className={`btn btn-xs flex-1 capitalize ${priority === p ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPriority(prev => prev === p ? '' : p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">Customer</span>
                </label>
                <input
                  className="input input-bordered input-sm w-full"
                  value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  placeholder="Who is this for?"
                />
              </div>

              {/* Screen (add mode only) */}
              {mode === 'add' && (
                <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Screen</span>
                  </label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={screen}
                    onChange={e => setScreen(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
                </div>
              )}

              {/* Status */}
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
                    In Progress
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

              {/* Note */}
              <div className="form-control">
                  <label className="label py-0">
                    <span className="label-text text-xs font-semibold">Note</span>
                  </label>
                  <div className="flex gap-1 items-start">
                    <textarea
                      className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                      rows={3}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Type or speak an update..."
                    />
                    <button
                      className={`btn btn-sm ${listeningNote ? 'btn-error' : 'btn-outline'}`}
                      title={listeningNote ? 'Stop' : 'Speak'}
                      onClick={() => listeningNote
                        ? stopVoice(noteRecRef as React.MutableRefObject<unknown>, setListeningNote)
                        : startVoice(
                            text => setNote(prev => prev ? `${prev} ${text}` : text),
                            setListeningNote,
                            noteRecRef as React.MutableRefObject<unknown>,
                            true
                          )
                      }
                    >
                      {listeningNote ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    </button>
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
          {/* Find Similar Tasks */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4 space-y-3">
              <p className="font-semibold text-sm">Find similar tasks in the past</p>

              <div className="flex gap-1">
                <input
                  type="text"
                  className="input input-bordered input-sm w-16"
                  placeholder="#"
                  value={simNum}
                  onChange={e => {
                    setSimNum(e.target.value);
                    const num = parseInt(e.target.value);
                    if (!isNaN(num)) {
                      const found = allActive.find(t => t.task_number === num);
                      if (found) setSimName(found.title || found.description);
                    }
                  }}
                />
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  placeholder="Task name"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                />
              </div>

              <textarea
                className="textarea textarea-bordered textarea-sm w-full text-sm"
                rows={2}
                placeholder="Elaborate on what kind of similarity you're looking for..."
                value={simElab}
                onChange={e => setSimElab(e.target.value)}
              />

              <button
                className="btn btn-outline btn-sm w-full"
                onClick={handleFindSimilar}
                disabled={simLoading}
              >
                {simLoading ? <span className="loading loading-spinner loading-sm" /> : 'Find'}
              </button>

              {simMessage && (
                <p className="text-xs text-base-content/50 text-center">{simMessage}</p>
              )}

              {simResults.length > 0 && (
                <div className="space-y-2">
                  {simResults.map(r => (
                    <div key={r.id} className="bg-base-200 rounded-lg p-2">
                      <Link
                        href={`/issues/${r.id}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        #{r.task_number} {r.title}
                      </Link>
                      <p className="text-xs text-base-content/60 mt-0.5">{r.similarity}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

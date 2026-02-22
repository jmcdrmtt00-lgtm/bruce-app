'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { Incident } from '@/types';
import AddTaskModal from '@/components/AddTaskModal';
import VoiceInput from '@/components/VoiceInput';

const PRIORITY_BADGE: Record<string, string> = {
  high:   'badge-error',
  medium: 'badge-warning',
  low:    'badge-info',
};

const UPDATE_TYPES = [
  { value: 'approach' as const, label: 'Approach' },
  { value: 'progress' as const, label: 'Progress' },
  { value: 'resolved' as const, label: 'Resolved' },
];

function TaskTable({
  tasks,
  onRowClick,
}: {
  tasks: Incident[];
  onRowClick: (id: string) => void;
}) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <div className="card bg-base-100 shadow p-6 text-center text-base-content/40 text-sm">
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
            <th>Customer</th>
            <th>Screen</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr
              key={task.id}
              className="hover cursor-pointer"
              onClick={() => onRowClick(task.id)}
            >
              <td className="text-base-content/40 text-xs">{task.task_number}</td>
              <td>
                <p className="max-w-[180px] truncate font-medium text-sm">
                  {task.title || task.description.slice(0, 60)}
                </p>
              </td>
              <td>
                {task.priority && (
                  <span className={`badge badge-sm ${PRIORITY_BADGE[task.priority]}`}>
                    {task.priority}
                  </span>
                )}
              </td>
              <td className="text-xs text-base-content/60">
                <p className="max-w-[110px] truncate">{task.reported_by ?? ''}</p>
              </td>
              <td>
                {task.screen && (
                  <button
                    className="badge badge-outline badge-sm hover:badge-primary transition-colors"
                    onClick={e => {
                      e.stopPropagation();
                      router.push('/onboarding');
                    }}
                  >
                    {task.screen}
                  </button>
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
  const router = useRouter();
  const [tasks, setTasks] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<Incident | null>(null);
  const [updateType, setUpdateType] = useState<'approach' | 'progress' | 'resolved'>('progress');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadTasks = useCallback(() => {
    fetch('/api/issues')
      .then(r => r.json())
      .then(data => {
        setTasks(data.incidents ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const inProgress = useMemo(
    () => tasks
      .filter(t => t.status === 'in_progress')
      .sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );

  const queue = useMemo(
    () => tasks
      .filter(t => t.status === 'pending' || t.status === 'open')
      .sort((a, b) => a.task_number - b.task_number),
    [tasks]
  );

  const allActive = useMemo(() => [...inProgress, ...queue], [inProgress, queue]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const numQ = parseInt(q);
    return allActive.filter(t => {
      if (!isNaN(numQ) && t.task_number === numQ) return true;
      return (t.title || t.description).toLowerCase().includes(q);
    }).slice(0, 6);
  }, [searchQuery, allActive]);

  async function handleSeedData() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to load demo data');
      } else {
        toast.success('Demo data loaded!');
        loadTasks();
      }
    } catch {
      toast.error('Failed to load demo data');
    }
    setSeeding(false);
  }

  async function handleAddUpdate(note: string) {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/issues/${selectedTask.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: updateType, note }),
      });
      if (!res.ok) throw new Error();
      toast.success('Update saved!');
      setSelectedTask(null);
      setSearchQuery('');
      loadTasks();
    } catch {
      toast.error('Failed to save update.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-base-200 p-4">

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="max-w-md mx-auto mt-16 text-center">
            <div className="card bg-base-100 shadow-xl p-8">
              <Database className="w-12 h-12 text-base-content/30 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">No tasks yet</h2>
              <p className="text-base-content/60 mb-6">
                Start by adding a task, or load demo data to explore.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  className="btn btn-primary gap-2"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
                <button
                  className="btn btn-outline gap-2"
                  onClick={handleSeedData}
                  disabled={seeding}
                >
                  {seeding
                    ? <span className="loading loading-spinner loading-sm" />
                    : <Database className="w-4 h-4" />
                  }
                  Load Demo Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main 3-column layout */}
        {tasks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_300px] gap-4 items-start max-w-[1400px] mx-auto">

            {/* In Progress Column */}
            <div>
              <div className="stats bg-base-100 shadow w-full mb-3">
                <div className="stat py-3">
                  <div className="stat-title text-sm">In Progress</div>
                  <div className="stat-value text-2xl text-warning">{inProgress.length}</div>
                </div>
              </div>
              <TaskTable
                tasks={inProgress}
                onRowClick={id => router.push(`/issues/${id}`)}
              />
            </div>

            {/* Queue Column */}
            <div>
              <div className="stats bg-base-100 shadow w-full mb-3">
                <div className="stat py-3">
                  <div className="stat-title text-sm">Queue</div>
                  <div className="stat-value text-2xl text-info">{queue.length}</div>
                </div>
              </div>
              <TaskTable
                tasks={queue}
                onRowClick={id => router.push(`/issues/${id}`)}
              />
            </div>

            {/* Right Panel */}
            <div className="lg:sticky lg:top-4 space-y-3">
              <button
                className="btn btn-primary w-full gap-2"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>

              <div className="card bg-base-100 shadow">
                <div className="card-body p-4 space-y-3">
                  <p className="font-semibold text-sm">Update a Task</p>

                  {/* Task search */}
                  <div className="relative">
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full"
                      placeholder="Task # or name..."
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setSelectedTask(null);
                      }}
                    />
                    {searchQuery && !selectedTask && searchResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 overflow-hidden">
                        {searchResults.map(t => (
                          <div
                            key={t.id}
                            className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                            onClick={() => {
                              setSelectedTask(t);
                              setSearchQuery('');
                            }}
                          >
                            <span className="text-base-content/40 mr-2">#{t.task_number}</span>
                            {(t.title || t.description).slice(0, 50)}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchQuery && !selectedTask && searchResults.length === 0 && (
                      <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 px-3 py-2 text-sm text-base-content/40">
                        No matching tasks
                      </div>
                    )}
                  </div>

                  {/* Selected task update form */}
                  {selectedTask && (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 bg-base-200 rounded-lg p-2">
                        <p className="text-sm font-medium leading-snug">
                          <span className="text-base-content/40 mr-1">#{selectedTask.task_number}</span>
                          {(selectedTask.title || selectedTask.description).slice(0, 55)}
                        </p>
                        <button
                          className="btn btn-ghost btn-xs shrink-0"
                          onClick={() => { setSelectedTask(null); setSearchQuery(''); }}
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex gap-1 flex-wrap">
                        {UPDATE_TYPES.map(t => (
                          <button
                            key={t.value}
                            className={`btn btn-xs ${updateType === t.value ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUpdateType(t.value)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <VoiceInput
                        onSave={handleAddUpdate}
                        placeholder="Type or speak your update..."
                        saveLabel={saving ? 'Saving...' : 'Save Update'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      <AddTaskModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={loadTasks}
      />
    </>
  );
}

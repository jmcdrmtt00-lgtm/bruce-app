'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

interface IssuesComment {
  timestamp: string;
  text: string;
}

interface DemoTask {
  id: string;
  task_number: number | null;
  task_name: string | null;
  priority: string | null;
  date_due: string | null;
  status: string | null;
  information_needed: string | null;
  results: string | null;
  issues_comments: IssuesComment[];
}

const PRIORITY_CLASS: Record<string, string> = {
  High:   'badge-error',
  Medium: 'badge-warning',
  Low:    'badge-info',
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TaskCard({ task }: { task: DemoTask }) {
  const latestComment = task.issues_comments?.at(-1);
  const priorityClass = PRIORITY_CLASS[task.priority ?? ''] ?? 'badge-ghost';

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-4 px-5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">
              {task.task_number ? `#${task.task_number} ` : ''}{task.task_name}
            </p>
          </div>
          {task.priority && (
            <span className={`badge badge-sm shrink-0 ${priorityClass}`}>{task.priority}</span>
          )}
        </div>

        {task.date_due && (
          <p className="text-xs text-base-content/50 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Due {formatDate(task.date_due)}
          </p>
        )}

        {task.information_needed && (
          <div>
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Needs</p>
            <p className="text-xs text-base-content/70">{task.information_needed}</p>
          </div>
        )}

        {task.results && (
          <div>
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Results</p>
            <p className="text-xs text-base-content/70">{task.results}</p>
          </div>
        )}

        {latestComment && (
          <div className="border-t border-base-200 pt-2">
            <p className="text-xs text-base-content/40">{latestComment.timestamp}</p>
            <p className="text-xs text-base-content/60 italic">{latestComment.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<DemoTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => setTasks(data.tasks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inQueue     = tasks.filter(t => t.status === 'In Queue');
  const inProcess   = tasks.filter(t => t.status === 'In Process');

  return (
    <main className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Active Tasks</h1>
          <p className="text-base-content/60 mt-1">In Queue and In Process</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center py-16">
              <AlertCircle className="w-10 h-10 text-base-content/20 mb-3" />
              <p className="text-base-content/50">No tasks loaded yet. Upload a task spreadsheet to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* In Queue */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="badge badge-info badge-sm" />
                In Queue
                <span className="text-sm font-normal text-base-content/50">({inQueue.length})</span>
              </h2>
              {inQueue.length === 0 ? (
                <p className="text-sm text-base-content/40 italic px-1">Nothing queued</p>
              ) : (
                inQueue.map(t => <TaskCard key={t.id} task={t} />)
              )}
            </div>

            {/* In Process */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="badge badge-warning badge-sm" />
                In Process
                <span className="text-sm font-normal text-base-content/50">({inProcess.length})</span>
              </h2>
              {inProcess.length === 0 ? (
                <p className="text-sm text-base-content/40 italic px-1">Nothing in progress</p>
              ) : (
                inProcess.map(t => <TaskCard key={t.id} task={t} />)
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}

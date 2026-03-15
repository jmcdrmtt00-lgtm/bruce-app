'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/libs/supabase';
import {
  AutoTextarea,
  VoiceButton,
  startVoice,
  stopVoice,
  wrapVoiceResult,
} from '@/components/AiDiagnoseSection';

type Stage = 'idle' | 'questions' | 'assessed_it' | 'assessed_self' | 'coaching' | 'completed';

type Turn = { role: 'user' | 'ai'; content: string };

export default function MaybeByMyselfPage() {
  const [subject, setSubject]   = useState('');
  const [problem, setProblem]   = useState('');
  const [stage, setStage]       = useState<Stage>('idle');
  const [loading, setLoading]   = useState(false);

  // Questions
  const [questions, setQuestions] = useState<string[]>([]);
  const [answer, setAnswer]       = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);

  // Assessment
  const [assessReason, setAssessReason]     = useState('');
  const [itTicketNumber, setItTicketNumber] = useState<number | null>(null);

  // Coaching
  const [coachingSteps, setCoachingSteps] = useState<string[]>([]);

  // Voice
  const [listeningProblem, setListeningProblem] = useState(false);
  const [listeningAnswer,  setListeningAnswer]  = useState(false);
  const problemRecRef = useRef<unknown>(null);
  const answerRecRef  = useRef<unknown>(null);
  const clearLastRef  = useRef<() => void>(() => {});

  function wrap(onResult: (t: string) => void, clearFn: () => void) {
    return wrapVoiceResult(onResult, clearFn, clearLastRef);
  }

  // ── AI helpers ────────────────────────────────────────────────────────────

  async function callAssess(conv: Turn[], isFirst: boolean, info?: string) {
    const res = await fetch('/api/ai/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isFirst
          ? { problem_type: 'nurse_assess', stage: 'symptoms', information: info }
          : { problem_type: 'nurse_assess', stage: 'followup', conversation: conv },
      ),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `AI error (${res.status})`);
    }
    return res.json() as Promise<{ assessment?: string; reason?: string; questions?: string[] }>;
  }

  async function createItTicket(conv: Turn[]) {
    try {
      const summary = conv
        .map(t => `${t.role === 'user' ? 'Staff' : 'AI'}: ${t.content}`)
        .join('\n');
      const res = await fetch('/api/nurse/create-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          description: problem.trim(),
          conversation_summary: summary,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setItTicketNumber(d.task_number ?? null);
      }
    } catch {
      // Silent — still show the "IT notified" screen
    }
    setStage('assessed_it');
  }

  function applyAssessResult(
    data: { assessment?: string; reason?: string; questions?: string[] },
    conv: Turn[],
  ): boolean {
    // Returns true if we transitioned to a terminal stage
    if (data.assessment) {
      const aiTurn: Turn = { role: 'ai', content: data.reason ?? data.assessment };
      setConversation([...conv, aiTurn]);
      setAssessReason(data.reason ?? '');
      return true; // caller will branch on data.assessment
    }
    if (data.questions?.length) {
      const qs = data.questions;
      const aiTurn: Turn = { role: 'ai', content: qs.join('\n') };
      setConversation([...conv, aiTurn]);
      setQuestions(qs);
      setAnswer(qs.map((_, i) => `${i + 1}. `).join('\n'));
      setStage('questions');
      return false;
    }
    return false;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!subject.trim() || !problem.trim()) {
      toast.error('Please fill in both Subject and Problem to fix.');
      return;
    }
    setLoading(true);
    const info = `Subject: ${subject.trim()}\nProblem: ${problem.trim()}`;
    const userTurn: Turn = { role: 'user', content: info };
    const conv: Turn[] = [userTurn];
    setConversation(conv);
    try {
      const data = await callAssess(conv, true, info);
      const transitioned = applyAssessResult(data, conv);
      if (transitioned && data.assessment === 'it_needed') {
        await createItTicket([...conv, { role: 'ai', content: data.reason ?? '' }]);
      } else if (transitioned && data.assessment === 'self_fix') {
        setStage('assessed_self');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reach the AI — try again.');
    }
    setLoading(false);
  }

  async function handleSendAnswer() {
    if (!answer.trim()) return;
    const ans = answer.trim();
    setAnswer('');
    const userTurn: Turn = { role: 'user', content: ans };
    const conv = [...conversation, userTurn];
    setConversation(conv);
    setLoading(true);
    try {
      const data = await callAssess(conv, false);
      const transitioned = applyAssessResult(data, conv);
      if (transitioned && data.assessment === 'it_needed') {
        await createItTicket([...conv, { role: 'ai', content: data.reason ?? '' }]);
      } else if (transitioned && data.assessment === 'self_fix') {
        setStage('assessed_self');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reach the AI — try again.');
    }
    setLoading(false);
  }

  async function handleWantCoaching() {
    setLoading(true);
    const context = [
      `Subject: ${subject}`,
      `Problem: ${problem}`,
      conversation.length > 0
        ? `Context from Q&A:\n${conversation.map(t => `${t.role === 'user' ? 'Staff' : 'AI'}: ${t.content}`).join('\n')}`
        : null,
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: 'nurse_coach', stage: 'fix', information: context }),
      });
      const data = await res.json();
      if (res.ok && data.steps?.length) {
        setCoachingSteps(data.steps);
        setStage('coaching');
      } else {
        toast.error(data.error || 'Could not get coaching steps — try again.');
      }
    } catch {
      toast.error('Could not reach the AI — try again.');
    }
    setLoading(false);
  }

  async function handleNoCoaching() {
    setLoading(true);
    await createItTicket(conversation);
    setLoading(false);
  }

  async function handleMarkCompleted() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('incidents').insert({
          user_id:     user.id,
          title:       subject.trim(),
          description: problem.trim(),
          status:      'resolved',
          screen:      'problem_to_fix',
          source:      'nurse_self_fix',
        });
      }
    } catch {
      // Silent — still show completed screen
    }
    setStage('completed');
    setLoading(false);
  }

  function handleReset() {
    setSubject(''); setProblem(''); setStage('idle');
    setQuestions([]); setAnswer(''); setConversation([]);
    setAssessReason(''); setItTicketNumber(null); setCoachingSteps([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Maybe by myself</h1>

      {/* ── Idle: enter subject + problem ── */}
      {stage === 'idle' && (
        <div className="space-y-3">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold">Subject</span>
            </label>
            <input
              className="input input-bordered input-sm w-full"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Printer not working"
            />
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold">Problem to fix</span>
            </label>
            <div className="flex gap-1 items-start">
              <AutoTextarea
                className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                value={problem}
                onChange={e => setProblem(e.target.value)}
                placeholder="Describe what's happening..."
              />
              <VoiceButton
                listening={listeningProblem}
                onToggle={() =>
                  listeningProblem
                    ? stopVoice(problemRecRef, setListeningProblem)
                    : startVoice(
                        wrap(t => setProblem(prev => prev ? `${prev} ${t}` : t), () => setProblem('')),
                        setListeningProblem, problemRecRef, true,
                      )
                }
              />
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm w-full"
            onClick={handleSubmit}
            disabled={loading || !subject.trim() || !problem.trim()}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : 'Submit'}
          </button>
        </div>
      )}

      {/* ── Questions loop ── */}
      {stage === 'questions' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{subject}</p>
          <div className="rounded-box p-3 bg-primary/10 space-y-2">
            <p className="text-xs font-semibold text-base-content/50">
              To help figure out the problem, please answer:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
            <div className="flex gap-1 items-start">
              <AutoTextarea
                className="textarea textarea-bordered textarea-sm flex-1 text-sm font-mono"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder={questions.map((_, i) => `${i + 1}. `).join('\n')}
              />
              <VoiceButton
                listening={listeningAnswer}
                onToggle={() =>
                  listeningAnswer
                    ? stopVoice(answerRecRef, setListeningAnswer)
                    : startVoice(
                        wrap(t => setAnswer(prev => prev ? `${prev} ${t}` : t), () => setAnswer('')),
                        setListeningAnswer, answerRecRef, true,
                      )
                }
              />
            </div>
            <button
              className="btn btn-primary btn-sm w-full"
              onClick={handleSendAnswer}
              disabled={loading || !answer.trim()}
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* ── Assessment: IT needed ── */}
      {stage === 'assessed_it' && (
        <div className="space-y-3">
          <div className="rounded-box p-4 bg-info/10 text-sm space-y-2">
            <p className="font-semibold">IT will take care of this</p>
            {assessReason && <p>{assessReason}</p>}
            {itTicketNumber != null
              ? <p className="text-xs text-base-content/60">Ticket #{itTicketNumber} has been added to the IT queue.</p>
              : <p className="text-xs text-base-content/60">Your problem has been sent to IT.</p>
            }
          </div>
          <p className="text-xs text-base-content/50">
            You&apos;ll hear back from IT as soon as possible. Thank you for reporting this!
          </p>
        </div>
      )}

      {/* ── Assessment: self-fix possible ── */}
      {stage === 'assessed_self' && (
        <div className="space-y-3">
          <div className="rounded-box p-4 bg-success/10 text-sm space-y-2">
            <p className="font-semibold">Good news — you might be able to fix this yourself!</p>
            {assessReason && <p>{assessReason}</p>}
          </div>
          <p className="text-sm">Would you like step-by-step coaching to try to fix it?</p>
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm flex-1"
              onClick={handleWantCoaching}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Yes, walk me through it'}
            </button>
            <button
              className="btn btn-outline btn-sm flex-1"
              onClick={handleNoCoaching}
              disabled={loading}
            >
              No, let IT handle it
            </button>
          </div>
        </div>
      )}

      {/* ── Coaching ── */}
      {stage === 'coaching' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{subject}</p>
          <div className="rounded-box p-3 bg-success/10 space-y-2">
            <p className="text-xs font-semibold text-base-content/50">
              Here&apos;s how to fix it — try each step:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-2">
              {coachingSteps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </div>
          <button
            className="btn btn-success btn-sm w-full"
            onClick={handleMarkCompleted}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : 'Mark as completed'}
          </button>
          <button
            className="btn btn-outline btn-sm w-full"
            onClick={handleNoCoaching}
            disabled={loading}
          >
            I can&apos;t fix it — let IT handle it
          </button>
        </div>
      )}

      {/* ── Completed ── */}
      {stage === 'completed' && (
        <div className="rounded-box p-4 bg-success/10 space-y-2">
          <p className="font-semibold text-success">Great work! Problem marked as resolved.</p>
          <p className="text-sm">The problem has been saved to your record.</p>
          <button className="btn btn-ghost btn-sm mt-2" onClick={handleReset}>
            Report another problem
          </button>
        </div>
      )}
    </main>
  );
}

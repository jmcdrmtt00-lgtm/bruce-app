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

type Stage = 'idle' | 'questions' | 'assessed' | 'coaching' | 'completed';
type Turn  = { role: 'user' | 'ai'; content: string };

export default function MaybeByMyselfPage() {
  const [subject, setSubject] = useState('');
  const [problem, setProblem] = useState('');
  const [stage,   setStage]   = useState<Stage>('idle');
  const [loading, setLoading] = useState(false);

  // Q&A
  const [pastRounds,    setPastRounds]    = useState<{ questions: string[]; answer: string }[]>([]);
  const [questions,     setQuestions]     = useState<string[]>([]);
  const [answer,        setAnswer]        = useState('');
  const [conversation,  setConversation]  = useState<Turn[]>([]);

  // Assessment
  const [assessType,   setAssessType]   = useState<'it_needed' | 'self_fix' | null>(null);
  const [assessReason, setAssessReason] = useState('');

  // IT notification
  const [itNotified,    setItNotified]    = useState(false);
  const [itTicketNumber, setItTicketNumber] = useState<number | null>(null);

  // Coaching
  const [coachingSteps, setCoachingSteps] = useState<string[]>([]);

  // Clarification chat
  const [clarificationQ,       setClarificationQ]       = useState('');
  const [clarificationHistory, setClarificationHistory] = useState<{ q: string; a: string }[]>([]);
  const [listeningClarify,     setListeningClarify]     = useState(false);
  const clarifyRecRef = useRef<unknown>(null);

  // Voice
  const [listeningProblem, setListeningProblem] = useState(false);
  const [listeningAnswer,  setListeningAnswer]  = useState(false);
  const problemRecRef = useRef<unknown>(null);
  const answerRecRef  = useRef<unknown>(null);
  const clearLastRef  = useRef<() => void>(() => {});

  function wrap(onResult: (t: string) => void, clearFn: () => void) {
    return wrapVoiceResult(onResult, clearFn, clearLastRef);
  }

  // ── AI calls ──────────────────────────────────────────────────────────────

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

  /** Sets state from an assess response. Returns 'it_needed' | 'self_fix' | 'questions' | null. */
  function applyAssessResult(
    data: { assessment?: string; reason?: string; questions?: string[] },
    conv: Turn[],
  ): 'it_needed' | 'self_fix' | 'questions' | null {
    if (data.assessment) {
      const aiTurn: Turn = { role: 'ai', content: data.reason ?? data.assessment };
      setConversation([...conv, aiTurn]);
      setAssessReason(data.reason ?? '');
      setAssessType(data.assessment as 'it_needed' | 'self_fix');
      setStage('assessed');
      return data.assessment as 'it_needed' | 'self_fix';
    }
    if (data.questions?.length) {
      const qs = data.questions;
      setConversation([...conv, { role: 'ai', content: qs.join('\n') }]);
      setQuestions(qs);
      setAnswer(qs.map((_, i) => `${i + 1}. `).join('\n'));
      setStage('questions');
      return 'questions';
    }
    return null;
  }

  async function createItTicket(conv: Turn[]) {
    try {
      const summary = conv.map(t => `${t.role === 'user' ? 'Staff' : 'AI'}: ${t.content}`).join('\n');
      const res = await fetch('/api/nurse/create-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: problem.trim(), conversation_summary: summary }),
      });
      if (res.ok) setItTicketNumber((await res.json()).task_number ?? null);
    } catch { /* silent — still show IT card */ }
    setItNotified(true);
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
      const result = applyAssessResult(data, conv);
      if (result === 'it_needed') await createItTicket([...conv, { role: 'ai', content: data.reason ?? '' }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reach the AI — try again.');
    }
    setLoading(false);
  }

  async function handleSendAnswer() {
    if (!answer.trim()) return;
    const ans = answer.trim();
    setAnswer('');
    setPastRounds(prev => [...prev, { questions, answer: ans }]);
    const userTurn: Turn = { role: 'user', content: ans };
    const conv = [...conversation, userTurn];
    setConversation(conv);
    setLoading(true);
    try {
      const data = await callAssess(conv, false);
      const result = applyAssessResult(data, conv);
      if (result === 'it_needed') await createItTicket([...conv, { role: 'ai', content: data.reason ?? '' }]);
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
    } catch { toast.error('Could not reach the AI — try again.'); }
    setLoading(false);
  }

  async function handleNoCoaching() {
    setLoading(true);
    await createItTicket(conversation);
    setLoading(false);
  }

  async function handleClarification() {
    if (!clarificationQ.trim()) return;
    const q = clarificationQ.trim();
    setClarificationQ('');
    setLoading(true);
    const stepsContext = coachingSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const info = `Steps the staff member is following:\n${stepsContext}\n\nTheir question: ${q}`;
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: 'nurse_explain', stage: 'symptoms', information: info }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setClarificationHistory(prev => [...prev, { q, a: data.answer }]);
      } else {
        toast.error(data.error || 'Could not get a response — try again.');
        setClarificationQ(q);
      }
    } catch {
      toast.error('Could not reach the AI — try again.');
      setClarificationQ(q);
    }
    setLoading(false);
  }

  async function handleMarkCompleted() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('incidents').insert({
          user_id: user.id, title: subject.trim(), description: problem.trim(),
          status: 'resolved', screen: 'problem_to_fix', source: 'nurse_self_fix',
        });
      }
    } catch { /* silent */ }
    setStage('completed');
    setLoading(false);
  }

  function handleReset() {
    setSubject(''); setProblem(''); setStage('idle');
    setPastRounds([]); setQuestions([]); setAnswer(''); setConversation([]);
    setAssessType(null); setAssessReason(''); setItNotified(false); setItTicketNumber(null);
    setCoachingSteps([]); setClarificationQ(''); setClarificationHistory([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const submitted = stage !== 'idle';

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Submit Ticket</h1>

      {/* ── Subject — always visible ── */}
      <div className="form-control">
        <label className="label py-1"><span className="label-text font-semibold">Subject</span></label>
        {submitted
          ? <p className="text-sm font-medium px-1 py-0.5">{subject}</p>
          : <input className="input input-bordered input-sm w-full" value={subject}
              onChange={e => setSubject(e.target.value)} placeholder="e.g. Printer not working" />
        }
      </div>

      {/* ── Problem — always visible ── */}
      <div className="form-control">
        <label className="label py-1"><span className="label-text font-semibold">Problem to fix</span></label>
        {submitted
          ? <p className="text-sm px-1 py-0.5 whitespace-pre-wrap">{problem}</p>
          : (
            <div className="flex gap-1 items-start">
              <AutoTextarea
                className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                value={problem} onChange={e => setProblem(e.target.value)}
                placeholder="Describe what's happening..."
              />
              <VoiceButton listening={listeningProblem} onToggle={() =>
                listeningProblem
                  ? stopVoice(problemRecRef, setListeningProblem)
                  : startVoice(wrap(t => setProblem(prev => prev ? `${prev} ${t}` : t), () => setProblem('')),
                      setListeningProblem, problemRecRef, true)
              } />
            </div>
          )
        }
      </div>

      {/* ── Submit — idle only ── */}
      {!submitted && (
        <button className="btn btn-primary btn-sm w-full" onClick={handleSubmit}
          disabled={loading || !subject.trim() || !problem.trim()}>
          {loading ? <span className="spinner spinner-sm" /> : 'Submit'}
        </button>
      )}

      {/* ── Past Q&A rounds (accumulated, read-only) ── */}
      {pastRounds.map((r, i) => (
        <div key={i} className="rounded-box p-3 bg-base-200 space-y-2 text-sm opacity-70">
          <p className="text-xs font-semibold text-base-content/50">Questions asked:</p>
          <ol className="list-decimal list-inside space-y-1">
            {r.questions.map((q, j) => <li key={j}>{q}</li>)}
          </ol>
          <p className="text-xs font-semibold text-base-content/50">Your answers:</p>
          <p className="whitespace-pre-wrap font-mono text-xs">{r.answer}</p>
        </div>
      ))}

      {/* ── Current active questions ── */}
      {stage === 'questions' && (
        <div className="rounded-box p-3 bg-primary/10 space-y-2">
          <p className="text-xs font-semibold text-base-content/50">To help figure out the problem, please answer:</p>
          <ol className="list-decimal list-inside text-sm space-y-1">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
          <div className="flex gap-1 items-start">
            <AutoTextarea
              className="textarea textarea-bordered textarea-sm flex-1 text-sm font-mono"
              value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder={questions.map((_, i) => `${i + 1}. `).join('\n')}
            />
            <VoiceButton listening={listeningAnswer} onToggle={() =>
              listeningAnswer
                ? stopVoice(answerRecRef, setListeningAnswer)
                : startVoice(wrap(t => setAnswer(prev => prev ? `${prev} ${t}` : t), () => setAnswer('')),
                    setListeningAnswer, answerRecRef, true)
            } />
          </div>
          <button className="btn btn-primary btn-sm w-full" onClick={handleSendAnswer}
            disabled={loading || !answer.trim()}>
            {loading ? <span className="spinner spinner-sm" /> : 'Send'}
          </button>
        </div>
      )}

      {/* ── Assessment result (stays visible) ── */}
      {assessType && (
        <div className={`rounded-box p-4 text-sm space-y-1 ${assessType === 'self_fix' ? 'bg-success/10' : 'bg-info/10'}`}>
          {assessType === 'self_fix'
            ? <p className="font-semibold">Good news — you might be able to fix this yourself!</p>
            : <p className="font-semibold">This one needs IT&apos;s attention</p>
          }
          {assessReason && <p>{assessReason}</p>}
        </div>
      )}

      {/* ── Self-fix choice buttons (only before a choice is made) ── */}
      {stage === 'assessed' && assessType === 'self_fix' && !itNotified && (
        <div className="space-y-2">
          <p className="text-sm">Would you like step-by-step coaching to try to fix it yourself?</p>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" onClick={handleWantCoaching} disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : 'Yes, walk me through it'}
            </button>
            <button className="btn btn-outline btn-sm flex-1" onClick={handleNoCoaching} disabled={loading}>
              No, let IT handle it
            </button>
          </div>
        </div>
      )}

      {/* ── IT notified card (stays visible once shown) ── */}
      {itNotified && (
        <div className="rounded-box p-4 bg-info/10 text-sm space-y-1">
          <p className="font-semibold">IT will take care of this</p>
          {itTicketNumber != null
            ? <p className="text-xs text-base-content/70">Ticket #{itTicketNumber} has been added to the IT queue.</p>
            : <p className="text-xs text-base-content/70">Your problem has been sent to IT.</p>
          }
          <p className="text-xs text-base-content/50">You&apos;ll hear back as soon as possible. Thank you for reporting this!</p>
        </div>
      )}

      {/* ── Coaching steps (stays visible once shown) ── */}
      {coachingSteps.length > 0 && (
        <div className="rounded-box p-3 bg-success/10 space-y-2">
          <p className="text-xs font-semibold text-base-content/50">Here&apos;s how to fix it — try each step:</p>
          <ol className="list-decimal list-inside text-sm space-y-2">
            {coachingSteps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}

      {/* ── Clarification chat + action buttons (coaching stage, before IT takes over) ── */}
      {stage === 'coaching' && !itNotified && (
        <div className="space-y-3">

          {/* Clarification history */}
          {clarificationHistory.map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="rounded-box p-2 bg-base-200 text-sm">
                <span className="font-semibold text-base-content/60">You: </span>{item.q}
              </div>
              <div className="rounded-box p-2 bg-primary/10 text-sm">
                <span className="font-semibold">IT Buddy: </span>{item.a}
              </div>
            </div>
          ))}

          {/* Clarification input */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-base-content/50">Have a question about these steps?</p>
            <div className="flex gap-1 items-start">
              <AutoTextarea
                className="textarea textarea-bordered textarea-sm flex-1 text-sm"
                value={clarificationQ} onChange={e => setClarificationQ(e.target.value)}
                placeholder={'e.g. What does "restart" mean?'}
              />
              <VoiceButton listening={listeningClarify} onToggle={() =>
                listeningClarify
                  ? stopVoice(clarifyRecRef, setListeningClarify)
                  : startVoice(wrap(t => setClarificationQ(prev => prev ? `${prev} ${t}` : t), () => setClarificationQ('')),
                      setListeningClarify, clarifyRecRef, true)
              } />
            </div>
            <button className="btn btn-primary btn-sm w-full" onClick={handleClarification}
              disabled={loading || !clarificationQ.trim()}>
              {loading ? <span className="spinner spinner-sm" /> : 'Ask IT Buddy'}
            </button>
          </div>

          {/* Action buttons */}
          <button className="btn btn-success btn-sm w-full" onClick={handleMarkCompleted} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : 'Mark as completed'}
          </button>
          <button className="btn btn-outline btn-sm w-full" onClick={handleNoCoaching} disabled={loading}>
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

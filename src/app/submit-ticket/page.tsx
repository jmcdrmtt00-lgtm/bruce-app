'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/libs/supabase';
import { useOrg } from '@/contexts/OrgContext';

type Stage = 'idle' | 'questions' | 'assessed' | 'coaching' | 'completed';
type Turn  = { role: 'user' | 'ai'; content: string };

function AutoTextarea({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
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
      placeholder={placeholder}
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

export default function SubmitTicketPage() {
  const { activeOrgId } = useOrg();
  // Profile / identity
  const [email, setEmail]               = useState('');
  const [requester, setRequester]       = useState('');
  const [location, setLocation]         = useState('');
  const [priority, setPriority]         = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFound, setProfileFound] = useState<boolean | null>(null);

  // Subject + problem
  const [subject, setSubject] = useState('');
  const [problem, setProblem] = useState('');

  // Stage
  const [stage,   setStage]   = useState<Stage>('idle');
  const [loading, setLoading] = useState(false);

  // Q&A
  const [pastRounds,   setPastRounds]   = useState<{ questions: string[]; answer: string }[]>([]);
  const [questions,    setQuestions]    = useState<string[]>([]);
  const [answer,       setAnswer]       = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);

  // Assessment
  const [assessType,   setAssessType]   = useState<'it_needed' | 'self_fix' | null>(null);
  const [assessReason, setAssessReason] = useState('');

  // IT notification
  const [itNotified,     setItNotified]     = useState(false);
  const [itTicketNumber, setItTicketNumber] = useState<number | null>(null);

  // Coaching
  const [coachingSteps, setCoachingSteps] = useState<string[]>([]);

  // Clarification
  const [clarificationQ,       setClarificationQ]       = useState('');
  const [clarificationHistory, setClarificationHistory] = useState<{ q: string; a: string }[]>([]);
  const [listeningClarify,     setListeningClarify]     = useState(false);
  const clarifyRecRef = useRef<unknown>(null);

  // Voice
  const [listeningSubject, setListeningSubject] = useState(false);
  const [listeningProblem, setListeningProblem] = useState(false);
  const [listeningAnswer,  setListeningAnswer]  = useState(false);
  const subjectRecRef = useRef<unknown>(null);
  const problemRecRef = useRef<unknown>(null);
  const answerRecRef  = useRef<unknown>(null);
  const clearLastRef  = useRef<() => void>(() => {});

  // Pre-fill email from the logged-in user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupProfile(emailAddr: string) {
    if (!emailAddr.trim()) return;
    setProfileLoading(true);
    setProfileFound(null);
    try {
      const params = new URLSearchParams({ email: emailAddr.trim() });
      if (activeOrgId) params.set('org_id', activeOrgId);
      const res = await fetch(`/api/nurse/profile?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRequester(data.full_name || '');
        setLocation(data.site || '');
        setPriority(data.default_priority || '');
        setProfileFound(true);
      } else {
        setProfileFound(false);
        setRequester(''); setLocation(''); setPriority('');
      }
    } catch {
      setProfileFound(false);
    }
    setProfileLoading(false);
  }

  // ── Voice helpers ─────────────────────────────────────────────────────────

  function startVoice(
    onResult: (text: string) => void,
    setActive: (v: boolean) => void,
    ref: React.MutableRefObject<unknown>,
    continuous = false,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input requires Chrome.'); return; }
    const r = new SR();
    r.continuous = continuous;
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      onResult(e.results[e.resultIndex][0].transcript);
    };
    r.onerror = (e: { error: string }) => {
      setActive(false);
      if (e.error === 'not-allowed') toast.error('Microphone access was denied.');
      else if (e.error !== 'no-speech') toast.error(`Voice error: ${e.error}`);
    };
    r.onend = () => setActive(false);
    try { r.start(); ref.current = r; setActive(true); }
    catch (err) { toast.error(`Could not start voice: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function stopVoice(ref: React.MutableRefObject<unknown>, setActive: (v: boolean) => void) {
    (ref.current as { stop: () => void } | null)?.stop();
    setActive(false);
  }

  function wrapVoiceResult(onResult: (text: string) => void, clearFn: () => void) {
    return (text: string) => {
      const lower = text.toLowerCase().trim();
      if (lower.startsWith('hey buddy')) {
        const cmd = lower.slice('hey buddy'.length).trim();
        if (cmd.includes('clear') || cmd.includes('remove') || cmd.includes('erase') || cmd.includes('delete')) {
          clearLastRef.current();
          toast('Field cleared');
        }
      } else {
        onResult(text);
        clearLastRef.current = clearFn;
      }
    };
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
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `AI error (${res.status})`);
    return res.json() as Promise<{ assessment?: string; reason?: string; questions?: string[] }>;
  }

  function applyAssessResult(
    data: { assessment?: string; reason?: string; questions?: string[] },
    conv: Turn[],
  ): 'it_needed' | 'self_fix' | 'questions' | null {
    if (data.assessment) {
      setConversation([...conv, { role: 'ai', content: data.reason ?? data.assessment }]);
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
        ? `Context:\n${conversation.map(t => `${t.role === 'user' ? 'Staff' : 'AI'}: ${t.content}`).join('\n')}`
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
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_type: 'nurse_explain',
          stage: 'symptoms',
          information: `Steps:\n${stepsContext}\n\nQuestion: ${q}`,
        }),
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
          status: 'resolved', screen: 'problem_to_fix', source: 'submitted by nurse fixed by nurse',
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

  // ── Style constants (match Dashboard right panel) ─────────────────────────

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

  const submitted = stage !== 'idle';
  const canSubmit  = profileFound === true && !!subject.trim() && !!problem.trim();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100vh', background: '#0f1923', padding: '32px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#141f2d', border: '1px solid rgba(168,184,200,0.15)' }}
        >

          {/* ── Header strip: Email | Subject ─────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px 10px', borderBottom: '1px solid rgba(168,184,200,0.15)', minHeight: '46px' }}>
            {/* Email */}
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setProfileFound(null); setRequester(''); setLocation(''); setPriority(''); }}
              onBlur={() => lookupProfile(email)}
              placeholder="Email address"
              disabled={submitted}
              style={{ width: '210px', flexShrink: 0, fontSize: '12px', color: profileFound === false ? '#ff7070' : '#a8b8c8', background: 'none', border: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif", padding: 0 }}
            />
            <span style={{ color: 'rgba(168,184,200,0.25)', flexShrink: 0, userSelect: 'none' }}>|</span>
            {/* Subject — auto-sizing mirror */}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <span aria-hidden style={{ display: 'block', visibility: 'hidden', fontSize: '15px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'pre', padding: 0, lineHeight: '1.4', minWidth: '10ch' }}>
                {subject || '\u00a0'}
              </span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                readOnly={submitted}
                placeholder="Subject"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', fontSize: '15px', fontWeight: 600, color: '#ffffff', background: 'none', border: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif", padding: 0 }}
              />
            </div>
            <VoiceButton
              listening={listeningSubject}
              onToggle={() => listeningSubject
                ? stopVoice(subjectRecRef, setListeningSubject)
                : startVoice(wrapVoiceResult(t => setSubject(prev => prev ? `${prev} ${t}` : t), () => setSubject('')), setListeningSubject, subjectRecRef, false)
              }
            />
          </div>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Admin fields: Requester, Location, Priority */}
            <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(168,184,200,0.07)', borderRadius: '6px', padding: '10px 12px' }}>
              {profileLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner spinner-sm" />
                  <span style={{ fontSize: '11px', color: '#6b7d8f' }}>Looking up profile…</span>
                </div>
              ) : profileFound === false ? (
                <p style={{ fontSize: '11px', color: '#ff7070', margin: 0 }}>
                  Email not registered — please contact IT to be added.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={dpAdminLabel}>Requester</label>
                    <input value={requester} readOnly style={dpAdminInput} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={dpAdminLabel}>Location</label>
                    <input value={location} readOnly style={dpAdminInput} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={dpAdminLabel}>Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} disabled={submitted} style={dpAdminSelect}>
                      <option value="">—</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Working area — shown once profile is confirmed (or after submit) */}
            {(profileFound === true || submitted) && (
              <div style={{ borderLeft: '3px solid #4f8ef7', borderRadius: '6px', background: 'rgba(79,142,247,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Problem to fix */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={dpWorkLabel}>Problem to fix</label>
                  {submitted ? (
                    <p style={{ fontSize: '13px', color: '#eef2f7', whiteSpace: 'pre-wrap', margin: 0 }}>{problem}</p>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <AutoTextarea
                        style={{ ...dpWorkTextarea, flex: 1 }}
                        value={problem}
                        onChange={e => setProblem(e.target.value)}
                        placeholder="Describe what's happening…"
                      />
                      <VoiceButton
                        listening={listeningProblem}
                        onToggle={() => listeningProblem
                          ? stopVoice(problemRecRef, setListeningProblem)
                          : startVoice(wrapVoiceResult(t => setProblem(prev => prev ? `${prev} ${t}` : t), () => setProblem('')), setListeningProblem, problemRecRef, true)
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Submit button — idle only */}
                {!submitted && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !canSubmit}
                    style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: '6px', background: canSubmit && !loading ? '#4f8ef7' : '#2a3a4c', color: '#fff', border: 'none', cursor: canSubmit && !loading ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500 }}
                  >
                    {loading ? <span className="spinner spinner-sm" /> : 'Ask IT Buddy'}
                  </button>
                )}

                {/* Past Q&A rounds (read-only, accumulated) */}
                {pastRounds.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,184,200,0.08)', borderRadius: '6px', padding: '10px 12px', opacity: 0.7 }}>
                    <p style={{ fontSize: '10px', color: '#6b7d8f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>Questions asked:</p>
                    <ol style={{ paddingLeft: '16px', margin: '0 0 8px', fontSize: '12px', color: '#a8b8c8' }}>
                      {r.questions.map((q, j) => <li key={j}>{q}</li>)}
                    </ol>
                    <p style={{ fontSize: '10px', color: '#6b7d8f', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Your answers:</p>
                    <p style={{ fontSize: '12px', color: '#a8b8c8', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>{r.answer}</p>
                  </div>
                ))}

                {/* Active questions */}
                {stage === 'questions' && (
                  <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: '6px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '11px', color: '#4f8ef7', margin: 0 }}>To help figure out the problem, please answer:</p>
                    <ol style={{ paddingLeft: '16px', margin: 0, fontSize: '12px', color: '#eef2f7', lineHeight: 1.6 }}>
                      {questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ol>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <AutoTextarea
                        style={{ ...dpWorkTextarea, flex: 1 }}
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder={questions.map((_, i) => `${i + 1}. `).join('\n')}
                      />
                      <VoiceButton
                        listening={listeningAnswer}
                        onToggle={() => listeningAnswer
                          ? stopVoice(answerRecRef, setListeningAnswer)
                          : startVoice(wrapVoiceResult(t => setAnswer(prev => prev ? `${prev} ${t}` : t), () => setAnswer('')), setListeningAnswer, answerRecRef, true)
                        }
                      />
                    </div>
                    <button
                      onClick={handleSendAnswer}
                      disabled={loading || !answer.trim()}
                      style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: '5px', background: '#4f8ef7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, opacity: loading ? 0.7 : 1 }}
                    >
                      {loading ? <span className="spinner spinner-sm" /> : 'Send'}
                    </button>
                  </div>
                )}

                {/* Assessment result */}
                {assessType && (
                  <div style={{ background: assessType === 'self_fix' ? 'rgba(34,204,110,0.08)' : 'rgba(79,142,247,0.08)', border: `1px solid ${assessType === 'self_fix' ? 'rgba(34,204,110,0.2)' : 'rgba(79,142,247,0.2)'}`, borderRadius: '6px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: assessType === 'self_fix' ? '#22cc6e' : '#4f8ef7', margin: '0 0 4px' }}>
                      {assessType === 'self_fix' ? 'Good news — you might be able to fix this yourself!' : "This one needs IT's attention"}
                    </p>
                    {assessReason && <p style={{ fontSize: '12px', color: '#a8b8c8', margin: 0 }}>{assessReason}</p>}
                  </div>
                )}

                {/* Self-fix choice */}
                {stage === 'assessed' && assessType === 'self_fix' && !itNotified && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#a8b8c8', margin: 0 }}>Would you like step-by-step coaching to try to fix it yourself?</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleWantCoaching}
                        disabled={loading}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', background: '#4f8ef7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                      >
                        {loading ? <span className="spinner spinner-sm" /> : 'Yes, walk me through it'}
                      </button>
                      <button
                        onClick={handleNoCoaching}
                        disabled={loading}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#a8b8c8', border: '1px solid rgba(168,184,200,0.2)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        No, let IT handle it
                      </button>
                    </div>
                  </div>
                )}

                {/* IT notified */}
                {itNotified && (
                  <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: '6px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#4f8ef7', margin: '0 0 4px' }}>IT will take care of this</p>
                    <p style={{ fontSize: '11px', color: '#a8b8c8', margin: '0 0 2px' }}>
                      {itTicketNumber != null
                        ? `Ticket #${itTicketNumber} has been added to the IT queue.`
                        : 'Your problem has been sent to IT.'}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6b7d8f', margin: 0 }}>You&apos;ll hear back as soon as possible. Thank you for reporting this!</p>
                  </div>
                )}

                {/* Coaching steps */}
                {coachingSteps.length > 0 && (
                  <div style={{ background: 'rgba(34,204,110,0.06)', border: '1px solid rgba(34,204,110,0.15)', borderRadius: '6px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '10px', color: '#22cc6e', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Here&apos;s how to fix it — try each step:</p>
                    <ol style={{ paddingLeft: '16px', margin: 0, fontSize: '13px', color: '#eef2f7', lineHeight: 1.7 }}>
                      {coachingSteps.map((step, i) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
                    </ol>
                  </div>
                )}

                {/* Clarification chat + action buttons (coaching stage) */}
                {stage === 'coaching' && !itNotified && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                    {/* Clarification history */}
                    {clarificationHistory.map((item, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '5px', padding: '8px 10px', fontSize: '12px', color: '#a8b8c8' }}>
                          <span style={{ color: '#6b7d8f', marginRight: '4px' }}>You:</span>{item.q}
                        </div>
                        <div style={{ background: 'rgba(79,142,247,0.08)', borderRadius: '5px', padding: '8px 10px', fontSize: '12px', color: '#eef2f7' }}>
                          <span style={{ color: '#4f8ef7', marginRight: '4px' }}>IT Buddy:</span>{item.a}
                        </div>
                      </div>
                    ))}

                    {/* Clarification input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ fontSize: '11px', color: '#6b7d8f', margin: 0 }}>Have a question about these steps?</p>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <AutoTextarea
                          style={{ ...dpWorkTextarea, flex: 1 }}
                          value={clarificationQ}
                          onChange={e => setClarificationQ(e.target.value)}
                          placeholder={'e.g. What does "restart" mean?'}
                        />
                        <VoiceButton
                          listening={listeningClarify}
                          onToggle={() => listeningClarify
                            ? stopVoice(clarifyRecRef, setListeningClarify)
                            : startVoice(wrapVoiceResult(t => setClarificationQ(prev => prev ? `${prev} ${t}` : t), () => setClarificationQ('')), setListeningClarify, clarifyRecRef, true)
                          }
                        />
                      </div>
                      <button
                        onClick={handleClarification}
                        disabled={loading || !clarificationQ.trim()}
                        style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: '5px', background: '#4f8ef7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, opacity: loading ? 0.7 : 1 }}
                      >
                        {loading ? <span className="spinner spinner-sm" /> : 'Ask IT Buddy'}
                      </button>
                    </div>

                    {/* Mark completed / Let IT handle */}
                    <button
                      onClick={handleMarkCompleted}
                      disabled={loading}
                      style={{ padding: '8px', borderRadius: '6px', background: 'rgba(34,204,110,0.12)', color: '#22cc6e', border: '1px solid rgba(34,204,110,0.25)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                    >
                      {loading ? <span className="spinner spinner-sm" /> : 'Mark as completed'}
                    </button>
                    <button
                      onClick={handleNoCoaching}
                      disabled={loading}
                      style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#a8b8c8', border: '1px solid rgba(168,184,200,0.2)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}
                    >
                      I can&apos;t fix it — let IT handle it
                    </button>
                  </div>
                )}

                {/* Completed */}
                {stage === 'completed' && (
                  <div style={{ background: 'rgba(34,204,110,0.08)', border: '1px solid rgba(34,204,110,0.2)', borderRadius: '6px', padding: '14px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#22cc6e', margin: '0 0 6px' }}>Great work! Problem marked as resolved.</p>
                    <p style={{ fontSize: '12px', color: '#a8b8c8', margin: '0 0 12px' }}>The problem has been saved to your record.</p>
                    <button
                      onClick={handleReset}
                      style={{ padding: '6px 14px', borderRadius: '5px', background: 'rgba(255,255,255,0.05)', color: '#a8b8c8', border: '1px solid rgba(168,184,200,0.2)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Report another problem
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

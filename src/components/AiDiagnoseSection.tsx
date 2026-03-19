'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// ── Dark-theme style constants ─────────────────────────────────────────────────

const aiLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#a8b8c8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: '6px', display: 'block',
};
const aiInnerBox: React.CSSProperties = {
  background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.2)',
  borderRadius: '7px', padding: '12px',
};
const aiTextareaBase: React.CSSProperties = {
  fontSize: '13px', color: '#eef2f7', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(168,184,200,0.2)', borderRadius: '5px',
  padding: '8px 10px', outline: 'none', resize: 'none', overflow: 'hidden',
  minHeight: '2.25rem', width: '100%', fontFamily: "'DM Sans', sans-serif",
  lineHeight: 1.5,
};
const aiTextareaMono: React.CSSProperties = {
  ...aiTextareaBase, fontFamily: "'DM Mono', monospace",
};
const aiBtnPrimary: React.CSSProperties = {
  background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: '6px',
  padding: '8px 16px', fontSize: '13px', fontWeight: 500,
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '6px', fontFamily: "'DM Sans', sans-serif",
};
const aiBtnPrimaryFlex: React.CSSProperties = {
  ...aiBtnPrimary, width: 'auto', flex: 1,
};
const aiBtnOutline: React.CSSProperties = {
  background: 'transparent', color: '#a8b8c8',
  border: '1px solid rgba(168,184,200,0.3)', borderRadius: '6px',
  padding: '8px 16px', fontSize: '13px', fontWeight: 500, flex: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '6px', fontFamily: "'DM Sans', sans-serif",
};
const aiReplyBox: React.CSSProperties = {
  background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.18)',
  borderRadius: '6px', padding: '10px 12px',
  fontSize: '13px', color: '#eef2f7', whiteSpace: 'pre-wrap', lineHeight: 1.6,
};

// ── Shared UI helpers ──────────────────────────────────────────────────────────

export function AutoTextarea({ value, onChange, onBlur, placeholder, className, style }: {
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
    <textarea ref={ref} rows={1} value={value} onChange={onChange} onBlur={onBlur}
      placeholder={placeholder} className={className}
      style={{ resize: 'none', overflow: 'hidden', minHeight: '2.25rem', ...style }} />
  );
}

export function VoiceButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={listening ? 'Stop listening' : 'Tap to speak'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: listening ? '#22cc6e' : '#6b8aaa',
        filter: listening ? 'drop-shadow(0 0 4px rgba(34,204,110,0.6))' : 'none',
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

// ── Voice helpers ──────────────────────────────────────────────────────────────

export function startVoice(
  onResult: (text: string) => void,
  setActive: (v: boolean) => void,
  ref: React.MutableRefObject<unknown>,
  continuous = false,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { toast.error('Voice input requires Chrome.'); return; }
  const r = new SR();
  r.continuous = continuous; r.interimResults = false;
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

export function stopVoice(ref: React.MutableRefObject<unknown>, setActive: (v: boolean) => void) {
  (ref.current as { stop: () => void } | null)?.stop();
  setActive(false);
}

export function wrapVoiceResult(
  onResult: (text: string) => void,
  clearFn: () => void,
  clearLastRef: React.MutableRefObject<() => void>,
) {
  return (text: string) => {
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('hey buddy')) {
      const cmd = text.slice('hey buddy'.length).trim().toLowerCase();
      if (cmd.includes('clear') || cmd.includes('remove') || cmd.includes('erase')) {
        clearLastRef.current(); toast('Field cleared');
      }
    } else {
      onResult(text); clearLastRef.current = clearFn;
    }
  };
}

// ── AiDiagnoseSection ──────────────────────────────────────────────────────────

interface Props {
  selectedType: string;
  infoDone: string;
  setInfoDone: (v: string) => void;
  infoRequired?: string;
  onSaveUpdate?: (type: string, note: string) => Promise<void>;
  /** Called whenever diagStage changes so the parent can hide its infoDone field */
  onStageChange?: (stage: 'idle' | 'questions' | 'cause' | 'fix' | 'recommendation') => void;
  /** Restored from saved ai_response updates when reopening a task */
  initialCause?: string | null;
  initialActionsText?: string | null;
  initialRecommendation?: string | null;
}

export default function AiDiagnoseSection({
  selectedType, infoDone, setInfoDone, infoRequired = '',
  onSaveUpdate, onStageChange,
  initialCause = null, initialActionsText = null, initialRecommendation = null,
}: Props) {
  const router = useRouter();

  const [diagnosing,          setDiagnosing]          = useState(false);
  const [diagStage,           setDiagStageRaw]        = useState<'idle' | 'questions' | 'cause' | 'fix' | 'recommendation'>('idle');
  const [diagCause,           setDiagCause]           = useState<string | null>(null);
  const [diagDetail,          setDiagDetail]          = useState<string | null>(null);
  const [diagDetailOpen,      setDiagDetailOpen]      = useState(false);
  const [diagQuestions,       setDiagQuestions]       = useState<string[] | null>(null);
  const [diagSteps,           setDiagSteps]           = useState<string[] | null>(null);
  const [diagActionsText,     setDiagActionsText]     = useState('');
  const [diagRecommendation,  setDiagRecommendation]  = useState<string | null>(null);
  const [diagConversation,    setDiagConversation]    = useState<Record<string, unknown>[]>([]);
  const [diagAnswer,          setDiagAnswer]          = useState('');
  const [additionalHelpOpen,  setAdditionalHelpOpen]  = useState(false);
  const [additionalHelpText,  setAdditionalHelpText]  = useState('');
  const [additionalHelpReply, setAdditionalHelpReply] = useState<string | null>(null);

  const [listeningDiagCause,          setListeningDiagCause]          = useState(false);
  const [listeningDiagAnswer,         setListeningDiagAnswer]         = useState(false);
  const [listeningDiagActions,        setListeningDiagActions]        = useState(false);
  const [listeningDiagRecommendation, setListeningDiagRecommendation] = useState(false);
  const [listeningAdditionalHelp,     setListeningAdditionalHelp]     = useState(false);

  const diagCauseRecRef          = useRef<unknown>(null);
  const diagAnswerRecRef         = useRef<unknown>(null);
  const diagActionsRecRef        = useRef<unknown>(null);
  const diagRecommendationRecRef = useRef<unknown>(null);
  const additionalHelpRecRef     = useRef<unknown>(null);
  const clearLastVoiceFieldRef   = useRef<() => void>(() => {});
  const aiRestoredRef            = useRef(false);

  // Restore AI-generated content when a saved task is reopened
  useEffect(() => {
    if (aiRestoredRef.current) return;
    if (!initialRecommendation && !initialActionsText && !initialCause) return;
    if (initialRecommendation) {
      setDiagRecommendation(initialRecommendation);
      setDiagStageRaw('recommendation');
      onStageChange?.('recommendation');
    } else if (initialActionsText) {
      if (initialCause) setDiagCause(initialCause);
      setDiagActionsText(initialActionsText);
      setDiagSteps(initialActionsText.split('\n').map(s => s.replace(/^\d+\.\s*/, '')));
      setDiagStageRaw('fix');
      onStageChange?.('fix');
    } else if (initialCause) {
      setDiagCause(initialCause);
      setDiagStageRaw('cause');
      onStageChange?.('cause');
    }
    aiRestoredRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCause, initialActionsText, initialRecommendation]);

  function setDiagStage(s: 'idle' | 'questions' | 'cause' | 'fix' | 'recommendation') {
    setDiagStageRaw(s);
    onStageChange?.(s);
  }

  function wrap(onResult: (t: string) => void, clearFn: () => void) {
    return wrapVoiceResult(onResult, clearFn, clearLastVoiceFieldRef);
  }

  function formatDecisionResponse(alternatives: string[] | null, recommendation: string | null): string {
    const parts: string[] = [];
    if (alternatives?.length) parts.push(alternatives.join('\n'));
    if (recommendation) parts.push(recommendation);
    return parts.join('\n\n');
  }

  function resetDiag() {
    setDiagStage('idle');
    setDiagCause(null); setDiagDetail(null); setDiagDetailOpen(false);
    setDiagQuestions(null); setDiagSteps(null); setDiagActionsText('');
    setDiagRecommendation(null);
    setDiagConversation([]); setDiagAnswer('');
    setAdditionalHelpOpen(false); setAdditionalHelpText(''); setAdditionalHelpReply(null);
  }

  async function saveAi(type: string, note: string) {
    await onSaveUpdate?.(type, note);
  }

  async function handleDiagnose() {
    if (!selectedType) return;

    // Onboarding / offboarding → route to checklist
    if (selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding') {
      if (!infoDone.trim() && !infoRequired.trim()) {
        router.push('/onboarding');
        return;
      }
      setDiagnosing(true);
      try {
        const res = await fetch('/api/ai/diagnose', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problem_type: 'onboarding', stage: 'symptoms', task_details: infoRequired || null, information: infoDone || null }),
        });
        const data = await res.json();
        if (data.structured_data !== undefined) {
          localStorage.setItem('onboarding_prefill', JSON.stringify(data.structured_data));
          router.push('/onboarding');
        }
      } catch { toast.error('Could not get AI response — try again.'); }
      setDiagnosing(false);
      return;
    }

    setDiagnosing(true);
    resetDiag();

    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'symptoms', task_details: infoRequired || null, information: infoDone || null }),
      });
      const data = await res.json();
      const symptoms = [infoRequired, infoDone].filter(Boolean).join('\n') || 'No symptoms provided.';
      const userTurn = { role: 'user' as const, content: `Symptoms: ${symptoms}` };
      const toolTurns = data._tool_context ? [
        { role: 'tool_use' as const, tool_use_id: data._tool_context.tool_call.tool_use_id, name: data._tool_context.tool_call.name, input: data._tool_context.tool_call.input },
        { role: 'tool_result' as const, tool_use_id: data._tool_context.tool_call.tool_use_id, content: data._tool_context.tool_result },
      ] : [];

      if (!res.ok || data.error) {
        toast.error(data.error || `AI error (${res.status}) — try again.`);
      } else if (data.recommendation || data.alternatives?.length) {
        const formatted = formatDecisionResponse(data.alternatives ?? null, data.recommendation ?? null);
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: formatted }]);
        setDiagRecommendation(formatted); setDiagStage('recommendation');
        await saveAi('ai_response', `Recommendation: ${formatted}`);
      } else if (data.cause) {
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: data.cause }]);
        setDiagCause(data.cause); setDiagDetail(data.detail ?? null); setDiagStage('cause');
        await saveAi('ai_response', `Cause: ${data.cause}`);
      } else if (data.questions?.length) {
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: (data.questions as string[]).join('\n') }]);
        setDiagQuestions(data.questions); setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
        await saveAi('ai_response', `Questions: ${(data.questions as string[]).join(' | ')}`);
      }
    } catch (err) {
      console.error('[diagnose]', err);
      toast.error('Could not reach the AI — try again.');
    }
    setDiagnosing(false);
  }

  async function handleFollowUp() {
    if (!diagAnswer.trim() || !selectedType) return;
    const answer = diagAnswer.trim(); setDiagAnswer('');
    await saveAi('user_reply', answer);
    const userTurn = { role: 'user' as const, content: answer };
    const updatedConv = [...diagConversation, userTurn];
    setDiagConversation(updatedConv); setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'followup', conversation: updatedConv }),
      });
      const data = await res.json();
      if (data.recommendation || data.alternatives?.length) {
        const formatted = formatDecisionResponse(data.alternatives ?? null, data.recommendation ?? null);
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: formatted }]);
        setDiagRecommendation(formatted); setDiagStage('recommendation');
        await saveAi('ai_response', `Recommendation: ${formatted}`);
      } else if (data.cause) {
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: data.cause }]);
        setDiagCause(data.cause); setDiagDetail(data.detail ?? null); setDiagStage('cause');
        await saveAi('ai_response', `Cause: ${data.cause}`);
      } else if (data.questions?.length) {
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: (data.questions as string[]).join('\n') }]);
        setDiagQuestions(data.questions); setDiagStage('questions');
        setDiagAnswer((data.questions as string[]).map((_: string, i: number) => `${i + 1}. `).join('\n'));
        await saveAi('ai_response', `Questions: ${(data.questions as string[]).join(' | ')}`);
      }
    } catch { toast.error('Could not get AI response — try again.'); }
    setDiagnosing(false);
  }

  async function handleConfirmCause() {
    if (!diagCause || !selectedType) return;
    setDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'fix', information: diagCause }),
      });
      const data = await res.json();
      const steps: string[] = data.steps ?? [];
      setDiagSteps(steps);
      setDiagActionsText(steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
      setDiagStage('fix');
      await saveAi('ai_response', `Fix steps: ${steps.join(' | ')}`);
    } catch { toast.error('Could not get fix steps — try again.'); }
    setDiagnosing(false);
  }

  async function handleAdditionalHelp() {
    if (!additionalHelpText.trim() || !selectedType) return;
    const question = additionalHelpText.trim(); setAdditionalHelpText('');
    setDiagnosing(true);
    const userTurn = { role: 'user' as const, content: question };
    const updatedConv = [...diagConversation, userTurn];
    setDiagConversation(updatedConv);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_type: selectedType, stage: 'followup', conversation: updatedConv }),
      });
      const data = await res.json();
      const decisionFormatted = (data.recommendation || data.alternatives?.length) ? formatDecisionResponse(data.alternatives ?? null, data.recommendation ?? null) : null;
      const reply: string = decisionFormatted || data.cause || (data.questions as string[] | null)?.join('\n') || '';
      if (reply) {
        setAdditionalHelpReply(reply);
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: reply }]);
      }
    } catch { toast.error('Could not get AI response — try again.'); }
    setDiagnosing(false);
  }

  const isOnboarding = selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding';
  const isDecision   = selectedType === 'decision_to_make';

  function AdditionalHelpPanel({ label }: { label: string }) {
    return additionalHelpOpen ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <AutoTextarea
            style={{ ...aiTextareaBase, flex: 1 }}
            value={additionalHelpText}
            onChange={e => setAdditionalHelpText(e.target.value)}
            placeholder="What would you like to discuss?"
          />
          <VoiceButton
            listening={listeningAdditionalHelp}
            onToggle={() => listeningAdditionalHelp
              ? stopVoice(additionalHelpRecRef as React.MutableRefObject<unknown>, setListeningAdditionalHelp)
              : startVoice(wrap(t => setAdditionalHelpText(prev => prev ? `${prev} ${t}` : t), () => setAdditionalHelpText('')), setListeningAdditionalHelp, additionalHelpRecRef as React.MutableRefObject<unknown>, true)
            }
          />
        </div>
        {additionalHelpReply && (
          <div style={aiReplyBox}>{additionalHelpReply}</div>
        )}
        <button
          style={{ ...aiBtnPrimary, opacity: diagnosing || !additionalHelpText.trim() ? 0.5 : 1, cursor: diagnosing || !additionalHelpText.trim() ? 'not-allowed' : 'pointer' }}
          onClick={handleAdditionalHelp}
          disabled={diagnosing || !additionalHelpText.trim()}
        >
          {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
        </button>
      </div>
    ) : (
      <button style={aiBtnPrimary} onClick={() => setAdditionalHelpOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Idle state — Ask the AI button */}
      {diagStage === 'idle' && !isOnboarding && (
        <button
          style={{ ...aiBtnPrimary, opacity: diagnosing ? 0.6 : 1, cursor: diagnosing ? 'not-allowed' : 'pointer' }}
          onClick={handleDiagnose}
          disabled={diagnosing}
        >
          {diagnosing && <span className="loading loading-spinner loading-xs" />}
          {diagnosing ? 'Thinking…' : 'Ask the AI to diagnose'}
        </button>
      )}
      {diagStage === 'idle' && isOnboarding && (
        <button
          style={{ ...aiBtnPrimary, opacity: diagnosing ? 0.6 : 1, cursor: diagnosing ? 'not-allowed' : 'pointer' }}
          onClick={handleDiagnose}
          disabled={diagnosing}
        >
          {diagnosing && <span className="loading loading-spinner loading-xs" />}
          {diagnosing ? 'Thinking…' : 'Ask the AI'}
        </button>
      )}

      {diagStage !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Questions stage */}
          {diagStage === 'questions' && diagQuestions && (
            <div style={aiInnerBox}>
              <p style={{ fontSize: '12px', color: '#a8b8c8', marginBottom: '10px', margin: '0 0 10px 0' }}>
                To narrow down the cause, please answer:
              </p>
              <ol style={{ paddingLeft: '18px', margin: '0 0 10px 0', color: '#eef2f7', fontSize: '13px', lineHeight: 1.6 }}>
                {diagQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <AutoTextarea
                  style={{ ...aiTextareaMono, flex: 1 }}
                  value={diagAnswer}
                  onChange={e => setDiagAnswer(e.target.value)}
                  placeholder={diagQuestions.map((_, i) => `${i + 1}. `).join('\n')}
                />
                <VoiceButton
                  listening={listeningDiagAnswer}
                  onToggle={() => listeningDiagAnswer
                    ? stopVoice(diagAnswerRecRef as React.MutableRefObject<unknown>, setListeningDiagAnswer)
                    : startVoice(wrap(t => setDiagAnswer(prev => prev ? `${prev} ${t}` : t), () => setDiagAnswer('')), setListeningDiagAnswer, diagAnswerRecRef as React.MutableRefObject<unknown>, true)
                  }
                />
              </div>
              <button
                style={{ ...aiBtnPrimary, opacity: diagnosing || !diagAnswer.trim() ? 0.5 : 1, cursor: diagnosing || !diagAnswer.trim() ? 'not-allowed' : 'pointer' }}
                onClick={handleFollowUp}
                disabled={diagnosing || !diagAnswer.trim()}
              >
                {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
              </button>
            </div>
          )}

          {/* Cause stage */}
          {diagStage === 'cause' && !isOnboarding && diagCause && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={aiLabel}>Diagnosis</span>
              <div style={aiInnerBox}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <AutoTextarea
                    style={{ ...aiTextareaBase, flex: 1 }}
                    value={diagCause}
                    onChange={e => setDiagCause(e.target.value)}
                  />
                  <VoiceButton
                    listening={listeningDiagCause}
                    onToggle={() => listeningDiagCause
                      ? stopVoice(diagCauseRecRef as React.MutableRefObject<unknown>, setListeningDiagCause)
                      : startVoice(wrap(t => setDiagCause(prev => prev ? `${prev} ${t}` : t), () => setDiagCause(null)), setListeningDiagCause, diagCauseRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#4f8ef7', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    onClick={() => setDiagDetailOpen(o => !o)}
                  >
                    {diagDetailOpen ? 'Hide detail' : 'More detail →'}
                  </button>
                  {diagDetailOpen && (
                    <p style={{ fontSize: '12px', color: '#c0d0e0', marginTop: '6px', lineHeight: 1.5 }}>
                      {diagDetail ?? 'No additional detail available.'}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{ ...aiBtnPrimaryFlex, opacity: diagnosing ? 0.6 : 1, cursor: diagnosing ? 'not-allowed' : 'pointer' }}
                    onClick={handleConfirmCause}
                    disabled={diagnosing}
                  >
                    {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Actions to take'}
                  </button>
                  <button
                    style={{ ...aiBtnOutline, opacity: diagnosing ? 0.5 : 1, cursor: diagnosing ? 'not-allowed' : 'pointer' }}
                    disabled={diagnosing}
                    onClick={() => {
                      setDiagStage('questions');
                      setDiagQuestions(['What else can you tell me about the problem?']);
                      setDiagAnswer('1. '); setDiagCause(null); setDiagDetail(null);
                    }}
                  >
                    Not quite right
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fix stage */}
          {diagStage === 'fix' && diagSteps && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={aiLabel}>Problem to fix</span>
                <AutoTextarea style={aiTextareaBase} value={infoDone} onChange={e => setInfoDone(e.target.value)} />
              </div>
              <div>
                <span style={aiLabel}>Diagnosis</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <AutoTextarea style={{ ...aiTextareaBase, flex: 1 }} value={diagCause ?? ''} onChange={e => setDiagCause(e.target.value)} />
                  <VoiceButton
                    listening={listeningDiagCause}
                    onToggle={() => listeningDiagCause
                      ? stopVoice(diagCauseRecRef as React.MutableRefObject<unknown>, setListeningDiagCause)
                      : startVoice(wrap(t => setDiagCause(prev => prev ? `${prev} ${t}` : t), () => setDiagCause(null)), setListeningDiagCause, diagCauseRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>
              <div>
                <span style={aiLabel}>Actions to take</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <AutoTextarea style={{ ...aiTextareaBase, flex: 1 }} value={diagActionsText} onChange={e => setDiagActionsText(e.target.value)} />
                  <VoiceButton
                    listening={listeningDiagActions}
                    onToggle={() => listeningDiagActions
                      ? stopVoice(diagActionsRecRef as React.MutableRefObject<unknown>, setListeningDiagActions)
                      : startVoice(wrap(t => setDiagActionsText(prev => prev ? `${prev} ${t}` : t), () => setDiagActionsText('')), setListeningDiagActions, diagActionsRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>
              <AdditionalHelpPanel label="Ask the AI for additional help" />
            </div>
          )}

          {/* Recommendation stage (decision_to_make) */}
          {diagStage === 'recommendation' && isDecision && diagRecommendation !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={aiLabel}>Decision to make</span>
                <AutoTextarea style={aiTextareaBase} value={infoDone} onChange={e => setInfoDone(e.target.value)} />
              </div>
              <div>
                <span style={aiLabel}>Options &amp; Recommendation</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <AutoTextarea style={{ ...aiTextareaBase, flex: 1 }} value={diagRecommendation} onChange={e => setDiagRecommendation(e.target.value)} />
                  <VoiceButton
                    listening={listeningDiagRecommendation}
                    onToggle={() => listeningDiagRecommendation
                      ? stopVoice(diagRecommendationRecRef as React.MutableRefObject<unknown>, setListeningDiagRecommendation)
                      : startVoice(wrap(t => setDiagRecommendation(prev => prev ? `${prev} ${t}` : t), () => setDiagRecommendation(null)), setListeningDiagRecommendation, diagRecommendationRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>
              <AdditionalHelpPanel label="Discuss further with the AI" />
            </div>
          )}

        </div>
      )}
    </div>
  );
}

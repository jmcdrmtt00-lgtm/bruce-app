'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// ── Shared UI helpers ──────────────────────────────────────────────────────────

export function AutoTextarea({ value, onChange, onBlur, placeholder, className }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Resize on every render where value changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  };
  return (
    <textarea ref={ref} rows={1} value={value} onChange={handleChange} onBlur={onBlur}
      placeholder={placeholder} className={className}
      style={{ resize: 'none', overflow: 'hidden', minHeight: '2.25rem' }} />
  );
}

export function VoiceButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
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
}

export default function AiDiagnoseSection({
  selectedType, infoDone, setInfoDone, infoRequired = '',
  onSaveUpdate, onStageChange,
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

  function setDiagStage(s: 'idle' | 'questions' | 'cause' | 'fix' | 'recommendation') {
    setDiagStageRaw(s);
    onStageChange?.(s);
  }

  function wrap(onResult: (t: string) => void, clearFn: () => void) {
    return wrapVoiceResult(onResult, clearFn, clearLastVoiceFieldRef);
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
      } else if (data.recommendation) {
        setDiagConversation([userTurn, ...toolTurns, { role: 'ai' as const, content: data.recommendation }]);
        setDiagRecommendation(data.recommendation); setDiagStage('recommendation');
        await saveAi('ai_response', `Recommendation: ${data.recommendation}`);
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
      if (data.recommendation) {
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: data.recommendation }]);
        setDiagRecommendation(data.recommendation); setDiagStage('recommendation');
        await saveAi('ai_response', `Recommendation: ${data.recommendation}`);
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
      const reply: string = data.recommendation || data.cause || (data.questions as string[] | null)?.join('\n') || '';
      if (reply) {
        setAdditionalHelpReply(reply);
        setDiagConversation(prev => [...prev, { role: 'ai' as const, content: reply }]);
      }
    } catch { toast.error('Could not get AI response — try again.'); }
    setDiagnosing(false);
  }

  const isOnboarding = selectedType === 'onboarding' || selectedType === 'offboarding' || selectedType === 'onboarding_offboarding';
  const isDecision   = selectedType === 'decision_to_make';

  // ── Shared "discuss further / ask for help" panel ──────────────────────────
  function AdditionalHelpPanel({ label }: { label: string }) {
    return additionalHelpOpen ? (
      <div className="space-y-2">
        <div className="flex gap-1 items-start">
          <AutoTextarea
            className="textarea textarea-bordered textarea-sm flex-1 text-sm"
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
          <div className="rounded-box p-3 bg-primary/10 text-sm whitespace-pre-wrap">{additionalHelpReply}</div>
        )}
        <button className="btn btn-primary btn-sm w-full" onClick={handleAdditionalHelp} disabled={diagnosing || !additionalHelpText.trim()}>
          {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
        </button>
      </div>
    ) : (
      <button className="btn btn-primary btn-sm w-full" onClick={() => setAdditionalHelpOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Ask the AI button — only when idle and not onboarding */}
      {diagStage === 'idle' && !isOnboarding && (
        <div className="mt-2">
          <button className="btn btn-primary btn-sm w-full" onClick={handleDiagnose} disabled={diagnosing}>
            {diagnosing && <span className="loading loading-spinner loading-xs" />}
            {diagnosing ? 'Thinking…' : 'Ask the AI to diagnose'}
          </button>
        </div>
      )}

      {/* Onboarding: Ask the AI button */}
      {diagStage === 'idle' && isOnboarding && (
        <div className="mt-2">
          <button className="btn btn-primary btn-sm w-full" onClick={handleDiagnose} disabled={diagnosing}>
            {diagnosing && <span className="loading loading-spinner loading-xs" />}
            {diagnosing ? 'Thinking…' : 'Ask the AI'}
          </button>
        </div>
      )}

      {diagStage !== 'idle' && (
        <div className="form-control space-y-2">

          {/* Questions stage */}
          {diagStage === 'questions' && diagQuestions && (
            <div className="rounded-box p-3 bg-primary/10 space-y-2">
              <p className="text-xs font-semibold text-base-content/50">To narrow down the cause, please answer:</p>
              <ol className="list-decimal list-inside text-sm space-y-1">
                {diagQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
              <div className="flex gap-1 items-start">
                <AutoTextarea
                  className="textarea textarea-bordered textarea-sm flex-1 text-sm font-mono"
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
              <button className="btn btn-primary btn-sm w-full" onClick={handleFollowUp} disabled={diagnosing || !diagAnswer.trim()}>
                {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Send'}
              </button>
            </div>
          )}

          {/* Cause stage */}
          {diagStage === 'cause' && !isOnboarding && diagCause && (
            <div className="space-y-2">
              <label className="label py-0"><span className="label-text text-xs font-semibold">Diagnosis</span></label>
              <div className="rounded-box p-3 bg-primary/10 space-y-2">
                <div className="flex gap-1 items-start">
                  <AutoTextarea
                    className="textarea textarea-bordered textarea-sm flex-1 text-sm bg-white"
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
                <div>
                  <button className="text-xs text-primary underline" onClick={() => setDiagDetailOpen(o => !o)}>
                    {diagDetailOpen ? 'Hide detail' : 'More detail →'}
                  </button>
                  {diagDetailOpen && <p className="text-xs text-base-content/70 mt-1">{diagDetail ?? 'No additional detail available.'}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="btn btn-primary btn-sm flex-1" onClick={handleConfirmCause} disabled={diagnosing}>
                    {diagnosing ? <span className="loading loading-spinner loading-xs" /> : 'Actions to take'}
                  </button>
                  <button className="btn btn-outline btn-sm flex-1" disabled={diagnosing}
                    onClick={() => {
                      setDiagStage('questions');
                      setDiagQuestions(['What else can you tell me about the problem?']);
                      setDiagAnswer('1. '); setDiagCause(null); setDiagDetail(null);
                    }}>
                    Not quite right
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fix stage */}
          {diagStage === 'fix' && diagSteps && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="label py-0">
                  <span className="label-text text-xs font-semibold">
                    {selectedType === 'ticket_to_fix' ? 'Ticket to deal with' : 'Problem to fix'}
                  </span>
                </label>
                <AutoTextarea className="textarea textarea-bordered textarea-sm w-full text-sm" value={infoDone} onChange={e => setInfoDone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Diagnosis</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea className="textarea textarea-bordered textarea-sm flex-1 text-sm" value={diagCause ?? ''} onChange={e => setDiagCause(e.target.value)} />
                  <VoiceButton
                    listening={listeningDiagCause}
                    onToggle={() => listeningDiagCause
                      ? stopVoice(diagCauseRecRef as React.MutableRefObject<unknown>, setListeningDiagCause)
                      : startVoice(wrap(t => setDiagCause(prev => prev ? `${prev} ${t}` : t), () => setDiagCause(null)), setListeningDiagCause, diagCauseRecRef as React.MutableRefObject<unknown>, true)
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Actions to take</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea className="textarea textarea-bordered textarea-sm flex-1 text-sm" value={diagActionsText} onChange={e => setDiagActionsText(e.target.value)} />
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
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Decision to make</span></label>
                <AutoTextarea className="textarea textarea-bordered textarea-sm w-full text-sm" value={infoDone} onChange={e => setInfoDone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold">Options &amp; Recommendation</span></label>
                <div className="flex gap-1 items-start">
                  <AutoTextarea className="textarea textarea-bordered textarea-sm flex-1 text-sm" value={diagRecommendation} onChange={e => setDiagRecommendation(e.target.value)} />
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

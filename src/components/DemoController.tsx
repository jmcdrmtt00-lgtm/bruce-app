'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/contexts/DemoContext';

// ── DOM helpers ──────────────────────────────────────────────────────────────

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function waitForElement(selector: string, timeoutMs = 8000): Promise<Element | null> {
  return new Promise(resolve => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }

    const start = Date.now();
    const interval = setInterval(() => {
      const found = document.querySelector(selector);
      if (found) { clearInterval(interval); resolve(found); return; }
      if (Date.now() - start > timeoutMs) { clearInterval(interval); resolve(null); }
    }, 100);
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillField(field: string, value: string, speed: number) {
  // Try [name="field"] first (text inputs, selects, textareas)
  const selector = `[name="${field}"]`;
  const el = await waitForElement(selector);
  if (!el) { console.warn(`[Demo] element not found: ${selector}`); return; }

  if (el instanceof HTMLSelectElement) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el instanceof HTMLInputElement && el.type === 'date') {
    setNativeValue(el, value);
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Type character by character
    let current = '';
    for (const char of value) {
      current += char;
      setNativeValue(el, current);
      await sleep(speed);
    }
  }
}

async function clickAction(action: string) {
  const selector = `[data-demo="${action}"]`;
  const el = await waitForElement(selector);
  if (!el) { console.warn(`[Demo] clickable not found: ${selector}`); return; }
  (el as HTMLElement).click();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DemoController() {
  const demo = useDemo();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const runningRef = useRef(false);

  const { script, currentStep, isRunning, isPaused, message, totalSteps } = demo;

  // Step engine
  useEffect(() => {
    if (!isRunning || isPaused || !script) return;
    if (currentStep >= totalSteps) {
      // Script finished
      demo.setMessage('Demo complete!');
      return;
    }
    if (runningRef.current) return; // prevent double-fire
    runningRef.current = true;

    const step = script.steps[currentStep];

    async function executeStep() {
      try {
        if (step.type === 'navigate') {
          demo.setMessage(`Navigating to ${step.path}…`);
          router.push(step.path!);
          await sleep((step.pause ?? 2) * 1000);

        } else if (step.type === 'fill') {
          demo.setMessage(`Filling ${step.field}…`);
          await fillField(step.field!, step.value ?? '', step.speed ?? 80);
          await sleep((step.pause ?? 0.5) * 1000);

        } else if (step.type === 'click') {
          demo.setMessage(`Clicking ${step.action}…`);
          await clickAction(step.action!);
          await sleep((step.pause ?? 1) * 1000);

        } else if (step.type === 'pause') {
          demo.setMessage(step.message ?? '');
          await sleep((step.seconds ?? 1) * 1000);
        }
      } finally {
        runningRef.current = false;
        demo.advance();
      }
    }

    executeStep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isPaused, currentStep, script]);

  // Not in demo mode — invisible
  if (!isRunning) return null;

  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  // ── Minimized badge ──
  if (!expanded) {
    return (
      <button
        className="fixed bottom-4 right-4 z-50 btn btn-neutral btn-sm shadow-lg"
        onClick={() => setExpanded(true)}
      >
        🎬 DEMO {isPaused ? '⏸' : '▶'} {currentStep}/{totalSteps}
      </button>
    );
  }

  // ── Expanded card ──
  return (
    <div className="fixed bottom-4 right-4 z-50 card bg-base-100 shadow-2xl border border-base-300 w-72">
      <div className="card-body p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">🎬 Demo Mode</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setExpanded(false)}>—</button>
        </div>

        <div>
          <p className="text-xs font-semibold text-base-content/70">{script?.name}</p>
          {message && <p className="text-xs text-base-content/50 mt-0.5">{message}</p>}
        </div>

        <div>
          <div className="flex justify-between text-xs text-base-content/50 mb-1">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <progress className="progress progress-primary w-full" value={progress} max="100" />
        </div>

        <div className="flex gap-2">
          {isPaused ? (
            <button className="btn btn-primary btn-sm flex-1" onClick={demo.resume}>Resume</button>
          ) : (
            <button className="btn btn-warning btn-sm flex-1" onClick={demo.pause}>Pause</button>
          )}
          <button className="btn btn-error btn-sm flex-1" onClick={demo.stop}>Stop</button>
        </div>
      </div>
    </div>
  );
}

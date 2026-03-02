'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface DemoStep {
  type: 'navigate' | 'fill' | 'click' | 'pause';
  path?: string;
  field?: string;
  value?: string;
  speed?: number;
  pause?: number;
  action?: string;
  seconds?: number;
  message?: string;
}

export interface DemoScript {
  id: string;
  name: string;
  description: string;
  steps: DemoStep[];
}

interface DemoState {
  script: DemoScript | null;
  currentStep: number;
  isRunning: boolean;
  isPaused: boolean;
  message: string;
  totalSteps: number;
}

interface DemoActions {
  loadScript: (script: DemoScript) => void;
  advance: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setMessage: (msg: string) => void;
}

const DemoContext = createContext<(DemoState & DemoActions) | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [script, setScript] = useState<DemoScript | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [message, setMessage] = useState('');

  function loadScript(s: DemoScript) {
    setScript(s);
    setCurrentStep(0);
    setIsRunning(true);
    setIsPaused(false);
    setMessage('');
  }

  function advance() {
    setCurrentStep(prev => prev + 1);
  }

  function pause() {
    setIsPaused(true);
  }

  function resume() {
    setIsPaused(false);
  }

  function stop() {
    setScript(null);
    setCurrentStep(0);
    setIsRunning(false);
    setIsPaused(false);
    setMessage('');
  }

  return (
    <DemoContext.Provider value={{
      script,
      currentStep,
      isRunning,
      isPaused,
      message,
      totalSteps: script?.steps.length ?? 0,
      loadScript,
      advance,
      pause,
      resume,
      stop,
      setMessage,
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider');
  return ctx;
}

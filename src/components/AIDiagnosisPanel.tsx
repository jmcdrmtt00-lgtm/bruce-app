'use client';

import React, { useState } from 'react';
import { Sparkles, Activity, ClipboardList, CheckCircle2, RotateCcw, ChevronRight } from 'lucide-react';

interface AIDiagnosisPanelProps {
  diagnosis?: string;
  actions: string[];
  onRetry?: () => void;
}

const AIDiagnosisPanel = ({ diagnosis, actions, onRetry }: AIDiagnosisPanelProps) => {
  const [completedActions, setCompletedActions] = useState<number[]>([]);

  const toggleAction = (index: number) => {
    setCompletedActions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 1. The Diagnosis Header & Log */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
            <Activity size={14} />
            AI_Kernel_Diagnosis
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            <span className="font-mono text-[10px] text-slate-500 uppercase">Analysis_Complete</span>
          </div>
        </div>

        <div className="p-4 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-slate-900/50 to-transparent">
          <div className="font-mono text-sm leading-relaxed text-slate-300 border-l-2 border-emerald-500/30 pl-4 py-1">
            <span className="text-emerald-500/50 mr-2">$</span>
            {diagnosis || "Awaiting system telemetry for processing..."}
          </div>
        </div>
      </div>

      {/* 2. The Execution Plan (Actions) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/50">
          <ClipboardList size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">Recommended Execution Plan</h3>
        </div>
        <div className="p-2 space-y-1">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => toggleAction(idx)}
              className={`w-full flex items-start gap-3 p-3 rounded-md transition-all text-left border ${
                completedActions.includes(idx)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                  : 'bg-slate-900/50 border-transparent hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className={`mt-0.5 flex-shrink-0 transition-transform ${completedActions.includes(idx) ? 'scale-110' : ''}`}>
                {completedActions.includes(idx) ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <div className="h-[18px] w-[18px] rounded-full border-2 border-slate-700" />
                )}
              </div>
              <span className={`text-sm leading-snug ${completedActions.includes(idx) ? 'line-through opacity-60' : ''}`}>
                {action}
              </span>
            </button>
          ))}
        </div>

        {/* 3. Action Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-t border-slate-800">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-white transition-colors"
          >
            <RotateCcw size={12} />
            Refine_Diagnosis
          </button>

          <button className="group flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-all">
            <Sparkles size={14} />
            Ask_For_Further_Help
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIDiagnosisPanel;

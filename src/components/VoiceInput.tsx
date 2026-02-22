'use client';

import { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

interface Props {
  onSave: (text: string) => void;
  placeholder?: string;
  saveLabel?: string;
}

export default function VoiceInput({ onSave, placeholder, saveLabel = 'Save' }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input requires Chrome. Please use Chrome or type instead.');
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          setTranscript(prev => prev ? `${prev} ${event.results[i][0].transcript}` : event.results[i][0].transcript);
        }
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function handleSave() {
    const text = transcript.trim();
    if (text) {
      onSave(text);
      setTranscript('');
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="textarea textarea-bordered w-full min-h-28"
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder={placeholder || 'Tap the mic and speak, or type here...'}
      />
      <div className="flex gap-2 flex-wrap">
        {!isListening ? (
          <button type="button" className="btn btn-primary gap-2" onClick={startListening}>
            <Mic className="w-4 h-4" />
            Start Speaking
          </button>
        ) : (
          <button type="button" className="btn btn-error gap-2 animate-pulse" onClick={stopListening}>
            <Square className="w-4 h-4" />
            Stop
          </button>
        )}
        {transcript.trim() && (
          <>
            <button type="button" className="btn btn-success gap-2" onClick={handleSave}>
              {saveLabel}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTranscript('')}>
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';

export default function OrgSwitcher() {
  const { orgs, activeOrg, switchOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Nothing to show if user has no orgs or only one org with no alternatives
  if (orgs.length === 0 || !activeOrg) return null;

  if (orgs.length === 1) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '12px', color: '#4a5568', padding: '4px 8px',
        background: 'rgba(79,142,247,0.08)', borderRadius: '6px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <Building2 size={12} style={{ color: '#4f8ef7' }} />
        {activeOrg.name}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '12px', color: '#4a5568', padding: '4px 8px',
          background: open ? 'rgba(79,142,247,0.12)' : 'rgba(79,142,247,0.08)',
          border: '1px solid rgba(79,142,247,0.2)',
          borderRadius: '6px', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        }}
      >
        <Building2 size={12} style={{ color: '#4f8ef7' }} />
        {activeOrg.name}
        <ChevronDown size={11} style={{ color: '#4f8ef7', marginLeft: '1px' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          minWidth: '160px', zIndex: 1000, overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => { switchOrg(org.id); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', fontSize: '13px', cursor: 'pointer',
                background: org.id === activeOrg.id ? 'rgba(79,142,247,0.08)' : 'transparent',
                color: org.id === activeOrg.id ? '#4f8ef7' : '#1a1a2e',
                border: 'none', fontWeight: org.id === activeOrg.id ? 600 : 400,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

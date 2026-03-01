import type { DemoScript, DemoStep } from '@/contexts/DemoContext';

function parseOptions(optStr: string): { pause?: number; speed?: number; message?: string } {
  if (!optStr.trim()) return {};
  const result: { pause?: number; speed?: number; message?: string } = {};
  let remaining = optStr.trim();

  // Extract named key: number pairs (pause and speed)
  const pattern = /\b(pause|speed)\s*:\s*([\d.]+)/g;
  let match;
  while ((match = pattern.exec(optStr)) !== null) {
    if (match[1] === 'pause')  result.pause  = parseFloat(match[2]);
    if (match[1] === 'speed')  result.speed  = parseFloat(match[2]);
    remaining = remaining.replace(match[0], '');
  }

  // Whatever is left (after stripping commas/spaces) is the message
  remaining = remaining.replace(/^[,\s]+|[,\s]+$/g, '').trim();
  if (remaining) result.message = remaining;

  return result;
}

function parseStep(line: string): DemoStep | null {
  // Strip leading "- "
  const raw = line.replace(/^-\s*/, '').trim();

  // Split into instruction and options on the first " | "
  const pipeIdx = raw.indexOf(' | ');
  const instrStr = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;
  const optStr   = pipeIdx >= 0 ? raw.slice(pipeIdx + 3).trim() : '';

  const opts = parseOptions(optStr);

  // Split instruction on first ":"
  const colonIdx = instrStr.indexOf(':');
  if (colonIdx < 0) return null;
  const type = instrStr.slice(0, colonIdx).trim() as DemoStep['type'];
  const value = instrStr.slice(colonIdx + 1).trim();

  if (type === 'navigate') {
    return { type, path: value, pause: opts.pause ?? 2 };
  }

  if (type === 'fill') {
    const eqIdx = value.indexOf('=');
    if (eqIdx < 0) return null;
    const field = value.slice(0, eqIdx).trim();
    const val   = value.slice(eqIdx + 1).trim();
    return { type, field, value: val, speed: opts.speed, pause: opts.pause };
  }

  if (type === 'click') {
    return { type, action: value, pause: opts.pause ?? 1 };
  }

  if (type === 'pause') {
    return { type, seconds: parseFloat(value) || 1, message: opts.message };
  }

  return null;
}

export function parseDemoScript(md: string): DemoScript {
  const lines = md.split('\n');
  let name = '';
  let description = '';
  const steps: DemoStep[] = [];
  let descDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { if (name) descDone = true; continue; }

    if (trimmed.startsWith('# ')) {
      name = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('- ') && name) {
      descDone = true;
      const step = parseStep(trimmed);
      if (step) steps.push(step);
      continue;
    }

    if (name && !descDone) {
      description = description ? `${description} ${trimmed}` : trimmed;
    }
  }

  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return { id, name, description, steps };
}

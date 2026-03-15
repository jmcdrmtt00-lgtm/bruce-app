export interface TaskType {
  label: string;
  fields: string[];
}

export const QUICK_TASK_TYPES = [
  { id: 'problem_to_fix',   label: 'Problem to fix' },
  { id: 'ticket_to_fix',    label: 'Ticket to deal with' },
  { id: 'decision_to_make', label: 'Decision to make' },
  { id: 'onboarding',       label: 'Onboarding' },
  { id: 'offboarding',      label: 'Offboarding' },
] as const;

export const TASK_TYPES: Record<string, TaskType> = {
  problem_to_fix:  { label: 'Problem to fix',       fields: [] },
  ticket_to_fix:   { label: 'Ticket to deal with',  fields: [] },
  decision_to_make:{ label: 'Decision to make',     fields: [] },
  onboarding:      { label: 'Onboarding',           fields: ['First name', 'Last name', 'Role', 'Site', 'Start date'] },
  offboarding:     { label: 'Offboarding',          fields: ['First name', 'Last name', 'Role', 'Site', 'Last day'] },
  // legacy values
  general:                { label: 'General',                fields: [] },
  onboarding_offboarding: { label: 'Onboarding / Offboarding', fields: ['First name', 'Last name', 'Role', 'Site', 'Start date'] },
  project_to_manage:      { label: 'Project to manage',      fields: [] },
};

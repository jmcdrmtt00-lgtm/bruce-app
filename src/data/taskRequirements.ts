export interface TaskType {
  label: string;
  fields: string[];
}

export const QUICK_TASK_TYPES = [
  { id: 'problem_to_fix',        label: 'Problem to fix' },
  { id: 'ticket_to_fix',         label: 'Ticket to fix' },
  { id: 'onboarding_offboarding', label: 'Onboarding / Offboarding' },
  { id: 'decision_to_make',      label: 'Decision to make' },
  { id: 'project_to_manage',     label: 'Project to manage' },
] as const;

export const TASK_TYPES: Record<string, TaskType> = {
  problem_to_fix:         { label: 'Problem to fix',           fields: [] },
  ticket_to_fix:          { label: 'Ticket to fix',            fields: [] },
  onboarding_offboarding: { label: 'Onboarding / Offboarding', fields: ['First name', 'Last name', 'Role', 'Site', 'Start date'] },
  decision_to_make:       { label: 'Decision to make',         fields: [] },
  project_to_manage:      { label: 'Project to manage',        fields: [] },
  // legacy values
  general:    { label: 'General',    fields: [] },
  onboarding: { label: 'Onboarding', fields: [] },
};

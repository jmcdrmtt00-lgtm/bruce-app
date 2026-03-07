export interface TaskType {
  label: string;
  fields: string[];
}

export const QUICK_TASK_TYPES = [
  { id: 'general',    label: 'General' },
  { id: 'onboarding', label: 'Onboard' },
] as const;

export const TASK_TYPES: Record<string, TaskType> = {
  general: {
    label: 'General',
    fields: ['Describe the problem/question'],
  },
  onboarding: {
    label: 'Onboarding',
    fields: ['First name', 'Last name', 'Role', 'Site', 'Start date'],
  },
};

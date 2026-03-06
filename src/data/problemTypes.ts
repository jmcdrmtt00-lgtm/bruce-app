export interface ProblemType {
  label: string;
  questions: string[];
}

export const QUICK_TASK_TYPES = [
  { id: 'onboarding',      label: 'Onboarding' },
  { id: 'diagnose',        label: 'Diagnose and fix' },
  { id: 'update_database', label: 'Update database' },
] as const;

export const PROBLEM_TYPES: Record<string, ProblemType> = {
  onboarding: {
    label: 'Onboarding',
    questions: ['First name', 'Last name', 'Role', 'Site', 'Start date', 'Next asset #?', 'Computer name', 'Notes'],
  },
  diagnose: {
    label: 'Diagnose and fix',
    questions: ['Describe the problem'],
  },
  update_database: {
    label: 'Update database',
    questions: [],
  },
  intermittent_network_slowness: {
    label: 'Intermittent Network Slowness',
    questions: ['Affected location', 'Wired vs Wi-Fi', 'Time of day issue occurs', 'Number of affected users', 'Network device(s) serving that area', 'Recent network changes (if any)'],
  },
  application_performance_degradation: {
    label: 'Application Performance Degradation',
    questions: ['Application name + version', 'Server hosting the app', 'Number of affected users', 'Is issue location-specific?', 'Server CPU/RAM utilization snapshot', 'Last patch/update date', 'Any related error messages'],
  },
  access_drift_permission_sprawl: {
    label: 'Access Drift / Permission Sprawl',
    questions: ['User name + role', 'Resource name (e.g. folder, system, SharePoint site)', 'Current group memberships', 'Group required for access', 'Remote vs onsite context', 'Date issue started'],
  },
  recurring_endpoint_instability: {
    label: 'Recurring Endpoint Instability',
    questions: ['Device asset ID', 'Age and warranty status', 'OS version + last update', 'Crash frequency', 'Event Viewer error excerpt', 'Installed security tools'],
  },
  backup_reliability: {
    label: 'Backup Reliability / Restore Confidence Issues',
    questions: ['Server name', 'Backup job name', 'Last successful restore test date', 'Current storage capacity %', 'Error code (if any)', 'Retention policy settings'],
  },
};

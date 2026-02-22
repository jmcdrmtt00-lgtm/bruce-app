import { System, ComputerType } from '@/data/roles';
import { ROLES } from '@/data/roles';
import { SITES } from '@/data/sites';

export interface NewHire {
  firstName: string;
  lastName: string;
  role: keyof typeof ROLES;
  site: keyof typeof SITES;
  startDate: string;
  nextAssetNumber: string;
  computerName: string;
  notes: string;
}

export interface GeneratedOutput {
  hire: NewHire;
  loginId: string;
  systems: System[];
  computerType: ComputerType;
}

export interface Incident {
  id: string;
  user_id: string;
  title: string | null;
  description: string;
  reported_by: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  source: 'issue' | 'onboarding';
  onboarding_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  user_id: string;
  type: 'approach' | 'progress' | 'resolved';
  note: string;
  created_at: string;
}

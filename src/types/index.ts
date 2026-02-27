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
  status: 'open' | 'in_progress' | 'resolved' | 'pending';
  source: 'issue' | 'onboarding';
  onboarding_session_id: string | null;
  priority: 'high' | 'low' | null;
  screen: string | null;
  task_number: number;
  date_due: string | null;
  date_completed: string | null;
  auto_suggested: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  category: string;
  assigned_to: string | null;
  name: string | null;
  site: string | null;
  status: 'active' | 'retired';
  make: string | null;
  model: string | null;
  serial_number: string | null;
  asset_number: string | null;
  os: string | null;
  ram: string | null;
  purchased: string | null;
  price: number | null;
  install_date: string | null;
  warranty_expires: string | null;
  notes: string | null;
  extra: Record<string, unknown> | null;
  created_at: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  user_id: string;
  type: 'approach' | 'progress' | 'resolved';
  note: string;
  created_at: string;
}

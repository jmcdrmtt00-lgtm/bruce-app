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

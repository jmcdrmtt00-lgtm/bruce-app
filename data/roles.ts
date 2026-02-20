export type System = 'ad' | 'm365' | 'pcc' | 'ukg' | 'ringcentral' | 'splashtop';
export type ComputerType = 'desktop' | 'laptop' | 'desktop+laptop' | 'none';

export const ROLES = {
  executive:       { label: 'Executive',                   computer: 'desktop+laptop' as ComputerType, systems: ['ad','m365','pcc','ukg','ringcentral','splashtop'] as System[] },
  business_office: { label: 'Business Office',             computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  admissions:      { label: 'Admissions',                  computer: 'laptop' as ComputerType,         systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  hr:              { label: 'Human Resources',             computer: 'desktop' as ComputerType,        systems: ['ad','m365','ukg','ringcentral'] as System[] },
  don_adon:        { label: 'DON / ADON',                  computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  social_services: { label: 'Social Services / Case Mgr',  computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  activities:      { label: 'Activities',                  computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ringcentral'] as System[] },
  sdc:             { label: 'SDC',                         computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  home_health:     { label: 'Home Healthcare',             computer: 'desktop+laptop' as ComputerType, systems: ['ad','m365','pcc','ukg','ringcentral'] as System[] },
  maintenance:     { label: 'Maintenance',                 computer: 'desktop' as ComputerType,        systems: ['ad','m365','ringcentral'] as System[] },
  kitchen:         { label: 'Kitchen / Food Services',     computer: 'desktop' as ComputerType,        systems: ['ad','m365','ringcentral'] as System[] },
  concierge:       { label: 'Concierge',                   computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ringcentral'] as System[] },
  it:              { label: 'IT',                          computer: 'desktop' as ComputerType,        systems: ['ad','m365','pcc','ukg','ringcentral','splashtop'] as System[] },
  clinical_floor:  { label: 'CNA / Floor Clinical',        computer: 'none' as ComputerType,           systems: ['ukg'] as System[] },
};

export const SYSTEM_LABELS: Record<System, string> = {
  ad:          'Active Directory / Domain Account',
  m365:        'Microsoft 365 (Email)',
  pcc:         'PointClickCare (PCC)',
  ukg:         'UKG (Payroll / Scheduling)',
  ringcentral: 'RingCentral (Phone)',
  splashtop:   'Splashtop (Remote Access)',
};

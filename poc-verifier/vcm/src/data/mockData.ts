import type {
  Certificate,
  ComplianceCategory,
  ComplianceOverview,
  Vessel,
} from '@/types/compliance';

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  certificates: Certificate[];
}

export const crewCertificateTypes = [
  'Certificate of Competency',
  'First Aid',
  'Advanced Firefighting',
  'Identity Information',
] as const;

/**
 * Mock data for the PoC — no backend integration.
 * Values come from Vessel_compliance_manager/02-dashboard-requirements.md.
 */

export const vessel: Vessel = {
  name: 'MV Ocean Pioneer',
  lastUpdated: 'Today',
};

export const complianceCategories: ComplianceCategory[] = [
  {
    domain: 'vessel',
    title: 'Vessel Certificates',
    status: 'compliant',
    validCount: 24,
    totalCount: 24,
    description: 'No actions required',
  },
  {
    domain: 'company',
    title: 'Company Certificates',
    status: 'warning',
    validCount: 8,
    totalCount: 9,
    description: '1 expires within 30 days',
  },
  {
    domain: 'crew',
    title: 'Crew Certificates',
    status: 'critical',
    validCount: 12,
    totalCount: 16,
    description: '4 missing',
  },
];

export const complianceOverview: ComplianceOverview = {
  scorePercent: 92,
  expiredCount: 3,
  expiringCount: 8,
  missingCount: 13,
  overallStatus: 'critical', // "Action Required"
};

export const crewMembers: CrewMember[] = [
  {
    id: 'elena-marquez',
    name: 'Elena Marquez',
    role: 'Master',
    certificates: [
      { id: 'elena-coc', name: 'Certificate of Competency', domain: 'crew', status: 'valid', expiresAt: '2029-04-18' },
      { id: 'elena-first-aid', name: 'First Aid', domain: 'crew', status: 'valid', expiresAt: '2029-10-02' },
      { id: 'elena-firefighting', name: 'Advanced Firefighting', domain: 'crew', status: 'valid', expiresAt: '2028-06-12' },
      { id: 'elena-identity', name: 'Identity information', domain: 'crew', status: 'valid', expiresAt: '2028-11-25' },
    ],
  },
  {
    id: 'jonas-lind',
    name: 'Jonas Lind',
    role: 'Chief Engineer',
    certificates: [
      { id: 'jonas-coc', name: 'Certificate of Competency', domain: 'crew', status: 'valid', expiresAt: '2027-09-30' },
      { id: 'jonas-first-aid', name: 'First Aid', domain: 'crew', status: 'valid', expiresAt: '2027-03-14' },
      { id: 'jonas-firefighting', name: 'Advanced Firefighting', domain: 'crew', status: 'valid', expiresAt: '2028-08-19' },
      { id: 'jonas-identity', name: 'Identity information', domain: 'crew', status: 'valid', expiresAt: '2028-05-11' },
    ],
  },
  {
    id: 'amina-okafor',
    name: 'Amina Okafor',
    role: 'Second Officer',
    certificates: [
      { id: 'amina-coc', name: 'Certificate of Competency', domain: 'crew', status: 'valid', expiresAt: '2028-01-07' },
      { id: 'amina-first-aid', name: 'First Aid', domain: 'crew', status: 'valid', expiresAt: '2027-07-21' },
      { id: 'amina-firefighting', name: 'Advanced Firefighting', domain: 'crew', status: 'expiring', expiresAt: '2026-09-28', daysUntilExpiry: 19 },
      { id: 'amina-identity', name: 'Identity information', domain: 'crew', status: 'valid', expiresAt: '2027-12-03' },
    ],
  },
  {
    id: 'noah-bennett',
    name: 'Noah Bennett',
    role: 'First Officer',
    certificates: [],
  },
];


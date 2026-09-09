/**
 * Domain types for the Vessel Compliance Manager.
 *
 * These types are intentionally generic so the same shapes can back the
 * future pages: Vessel / Company / Crew Certificates, Certificate Detail
 * and Add Certificate.
 */

/** Certification domains tracked by the application. */
export type CertificateDomain = 'vessel' | 'company' | 'crew';

/** Rolled-up compliance status of a domain or of the vessel as a whole. */
export type ComplianceStatus = 'compliant' | 'warning' | 'critical';

/** Lifecycle status of a single certificate. */
export type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'missing';

/** A vessel under compliance review. */
export interface Vessel {
  name: string;
  lastUpdated: string;
}

/**
 * A single certificate. Reusable for list, detail and add-certificate pages.
 */
export interface Certificate {
  id: string;
  name: string;
  domain: CertificateDomain;
  /** Person or entity the certificate belongs to (e.g. crew member, company). */
  owner?: string;
  status: CertificateStatus;
  /** ISO date string when the certificate expires, if applicable. */
  expiresAt?: string;
  daysUntilExpiry?: number;
}

/** Aggregated compliance for one certification domain (dashboard card). */
export interface ComplianceCategory {
  domain: CertificateDomain;
  title: string;
  status: ComplianceStatus;
  validCount: number;
  totalCount: number;
  description: string;
}

/** Fleet-level compliance rollup shown in the hero section. */
export interface ComplianceOverview {
  scorePercent: number;
  expiredCount: number;
  expiringCount: number;
  missingCount: number;
  overallStatus: ComplianceStatus;
}


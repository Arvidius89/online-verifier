import { Badge } from '@fragment_ui/ui';
import type { ComplianceStatus } from '@/types/compliance';

/**
 * StatusBadge — thin wrapper around the Fragment UI Badge that applies the
 * semantic status colors (success / warning / error) from the design tokens.
 *
 * Fragment UI's Badge only ships solid/outline/subtle brand variants, so the
 * status tones are applied here via the `--color-status-*` CSS variables.
 * The -fg variants are the WCAG AA-safe text colors for light backgrounds.
 */

const statusClasses: Record<ComplianceStatus, string> = {
  compliant:
    'bg-[color:var(--color-status-success-bg)] text-[color:var(--color-status-success-fg)] border border-[color:var(--color-status-success-border)]',
  warning:
    'bg-[color:var(--color-status-warning-bg)] text-[color:var(--color-status-warning-fg)] border border-[color:var(--color-status-warning-border)]',
  critical:
    'bg-[color:var(--color-status-error-bg)] text-[color:var(--color-status-error-fg)] border border-[color:var(--color-status-error-border)]',
};

/** Default labels from Vessel_compliance_manager/05-ui-copy.md. */
const defaultLabels: Record<ComplianceStatus, string> = {
  compliant: 'Compliant',
  warning: 'Warning',
  critical: 'Action Required',
};

export interface StatusBadgeProps {
  status: ComplianceStatus;
  /** Override the default label, e.g. "Critical" on category cards. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant="subtle" className={[statusClasses[status], className].filter(Boolean).join(' ')}>
      {label ?? defaultLabels[status]}
    </Badge>
  );
}

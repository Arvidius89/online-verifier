import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@fragment_ui/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ComplianceCategory } from '@/types/compliance';

export interface ComplianceCategoryCardProps {
  category: ComplianceCategory;
  /** Called when the user activates "View Details". Placeholder in the PoC. */
  onViewDetails?: (domain: ComplianceCategory['domain']) => void;
}

const statusLabels: Record<ComplianceCategory['status'], string> = {
  compliant: 'Compliant',
  warning: 'Warning',
  critical: 'Critical',
};

/**
 * One certification domain (Vessel / Company / Crew) as a dashboard card.
 * Reusable on future domain pages as a summary tile.
 */
export function ComplianceCategoryCard({ category, onViewDetails }: ComplianceCategoryCardProps) {
  return (
    // w-full overrides Fragment UI Card's inline-flex default so the card
    // fills its grid column.
    <Card className="w-full shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{category.title}</CardTitle>
          <StatusBadge status={category.status} label={statusLabels[category.status]} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">
          {category.validCount}
          <span className="text-[length:var(--typography-size-lg)] font-normal text-[color:var(--color-fg-muted)]">
            {' '}
            / {category.totalCount}
          </span>
        </p>
        <p className="mt-1 text-[length:var(--typography-size-sm)] font-medium">Valid</p>
        <p className="mt-3 text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
          {category.description}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails?.(category.domain)}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}

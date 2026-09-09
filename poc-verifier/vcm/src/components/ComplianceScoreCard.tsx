import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MetricCard,
  Progress,
} from '@fragment_ui/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ComplianceOverview } from '@/types/compliance';

export interface ComplianceScoreCardProps {
  overview: ComplianceOverview;
}

/**
 * Hero element of the dashboard: the overall compliance score.
 *
 * Deliberately the largest typographic element on the page so that a
 * compliance officer can answer "is this vessel compliant today?" within
 * three seconds.
 */
export function ComplianceScoreCard({ overview }: ComplianceScoreCardProps) {
  return (
    // Fragment UI Card is inline-flex (shrink-to-fit) by default; w-full
    // makes the hero span the container so its right edge aligns with the
    // Crew Certificates card below.
    <Card aria-label="Compliance Overview" className="w-full shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Compliance Overview</CardTitle>
          <StatusBadge status={overview.overallStatus} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center">
          {/* Primary visual: the score itself */}
          <div>
            <p
              aria-label={`Compliance Score: ${overview.scorePercent} percent`}
              className="text-6xl font-bold leading-none tracking-tight"
            >
              {overview.scorePercent}
              <span className="text-3xl font-semibold text-[color:var(--color-fg-muted)]">%</span>
            </p>
            <p className="mt-2 text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
              Compliance Score
            </p>
            <Progress
              value={overview.scorePercent}
              color="warning"
              size="lg"
              className="mt-4"
              aria-label="Compliance score"
            />
          </div>

          {/* Supporting metrics */}
          <div className="grid gap-6 sm:grid-cols-3">
            <MetricCard
              title="Expired Certificates"
              value={overview.expiredCount}
              description="Require immediate renewal"
            />
            <MetricCard
              title="Expiring within 30 Days"
              value={overview.expiringCount}
              description="Schedule renewal"
            />
            <MetricCard
              title="Missing Certificates"
              value={overview.missingCount}
              description="Not on file"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

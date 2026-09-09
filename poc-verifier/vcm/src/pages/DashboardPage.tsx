import { AppHeader } from '@/components/AppHeader';
import { ComplianceCategoryCard } from '@/components/ComplianceCategoryCard';
import { ComplianceScoreCard } from '@/components/ComplianceScoreCard';
import { PageHeader } from '@/components/PageHeader';
import { VesselBanner } from '@/components/VesselBanner';
import {
  complianceCategories,
  complianceOverview,
  vessel,
} from '@/data/mockData';

/**
 * Dashboard — the PoC landing page of the Vessel Compliance Manager.
 *
 * Visual priority (top to bottom):
 *   1. Vessel identity
 *   2. Compliance Score (hero)
 *   3. Per-domain compliance status
 *
 * All sections share the same max-w-7xl container, so the Compliance
 * Overview hero aligns exactly with the Crew Certificates card edge.
 *
 * Mock data only, props-drilling only — no router, no state library.
 */
export function DashboardPage() {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <AppHeader title="Vessel Compliance Manager" user={{ name: 'Master', initials: 'M' }} />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <VesselBanner vessel={vessel} />

        {/* Hero: overall compliance score — same container width as the
            category grid below, so right edges align exactly. */}
        <ComplianceScoreCard overview={complianceOverview} />

        {/* Per-domain status */}
        <section aria-labelledby="compliance-status-heading" className="space-y-3">
          <PageHeader title="Compliance Status" headingId="compliance-status-heading" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {complianceCategories.map((category) => (
              <ComplianceCategoryCard
                key={category.domain}
                category={category}
                onViewDetails={
                  category.domain === 'crew'
                    ? () => {
                        window.location.hash = '#/crew';
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

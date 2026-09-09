import type { Vessel } from '@/types/compliance';

export interface VesselBannerProps {
  vessel: Vessel;
}

/**
 * Vessel summary strip shown directly under the header.
 * Answers "which vessel are we looking at?" within the first glance.
 */
export function VesselBanner({ vessel }: VesselBannerProps) {
  return (
    <section aria-label="Vessel summary" className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 className="text-[length:var(--typography-size-2xl)] font-bold tracking-tight">
        {vessel.name}
      </h1>
      <p className="text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
        Last updated: {vessel.lastUpdated}
      </p>
    </section>
  );
}

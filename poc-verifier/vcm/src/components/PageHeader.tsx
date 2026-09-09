import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional actions rendered on the right, e.g. a Button. */
  actions?: ReactNode;
  /** Optional id for the heading, for aria-labelledby on the parent section. */
  headingId?: string;
}

/**
 * Section/page title block with consistent typography hierarchy.
 * Reusable on the dashboard and future pages (certificate lists, detail).
 */
export function PageHeader({ title, subtitle, actions, headingId }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2
          id={headingId}
          className="text-[length:var(--typography-size-xl)] font-semibold tracking-tight"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

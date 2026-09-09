import { Avatar } from '@fragment_ui/ui';
import { Ship } from 'lucide-react';

export interface AppHeaderUser {
  name: string;
  initials: string;
}

export interface AppHeaderProps {
  title: string;
  user: AppHeaderUser;
}

/**
 * Top navigation bar. Simple header only — no sidebar in the PoC.
 * Reusable across all future pages of the compliance application.
 */
export function AppHeader({ title, user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-[color:var(--color-border-base)] bg-[color:var(--color-bg-base)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-primary)] text-white"
          >
            <Ship size={20} />
          </span>
          <span className="text-[length:var(--typography-size-lg)] font-semibold tracking-tight">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[length:var(--typography-size-sm)] text-[color:var(--color-fg-muted)] md:inline">
            {user.name}
          </span>
          <Avatar alt={user.name} fallback={user.initials} />
        </div>
      </div>
    </header>
  );
}

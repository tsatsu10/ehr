/**
 * SkipNav — Skip to main content link for keyboard navigation
 * Appears on focus for keyboard users, hidden visually otherwise
 */
import { cn } from '@/lib/utils';

interface SkipNavProps {
  /** Array of skip links with labels and target IDs */
  links: Array<{
    id: string;
    label: string;
    targetId: string;
  }>;
  /** Additional class names */
  className?: string;
}

/**
 * Skip navigation component for keyboard accessibility
 * 
 * Shows prominent links when focused via Tab key, allows users to
 * jump directly to main content areas without tabbing through all navigation
 * 
 * @example
 * <SkipNav links={[
 *   { id: 'skip-search', label: 'Skip to search', targetId: 'nc-search-input' },
 *   { id: 'skip-preview', label: 'Skip to patient preview', targetId: 'nc-preview' },
 *   { id: 'skip-main', label: 'Skip to main content', targetId: 'nc-front-desk' },
 * ]} />
 */
export function SkipNav({ links, className }: SkipNavProps) {
  const handleSkip = (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      // Focus the target element
      target.focus();
      // If target isn't focusable, scroll it into view
      if (document.activeElement !== target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Try to focus the first focusable element inside
        const focusable = target.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }
  };

  return (
    <nav
      className={cn(
        'nc-skip-nav',
        'fixed top-0 left-0 z-[9999] -translate-y-full',
        'focus-within:translate-y-0',
        'transition-transform duration-150',
        className
      )}
      aria-label="Skip navigation"
    >
      <div className="flex gap-2 p-2 bg-[var(--oe-nc-primary)] shadow-lg">
        {links.map((link) => (
          <a
            key={link.id}
            id={link.id}
            href={`#${link.targetId}`}
            onClick={(e) => handleSkip(e, link.targetId)}
            className={cn(
              'px-4 py-2 rounded',
              'text-sm font-medium text-white',
              'bg-[var(--oe-nc-primary)] hover:bg-[var(--oe-nc-primary-hover)]',
              'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2',
              'focus:ring-offset-[var(--oe-nc-primary)]',
              'no-underline',
              'transition-colors'
            )}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

import type { ReactNode } from 'react';

interface BannerClinicalLinkProps {
  enabled: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
}

export function BannerClinicalLink({
  enabled,
  href,
  className,
  children,
}: BannerClinicalLinkProps) {
  if (enabled && href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return <span className={className}>{children}</span>;
}

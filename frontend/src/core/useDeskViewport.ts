import { useEffect, useState } from 'react';

export type DeskViewport = 'mobile' | 'tablet' | 'desktop';

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(max-width: 991px)';

function resolveViewport(): DeskViewport {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

/** PRD §7.2.12 breakpoints: mobile ≤767, tablet 768–991, desktop ≥992 */
export function useDeskViewport(): DeskViewport {
  const [viewport, setViewport] = useState<DeskViewport>(resolveViewport);

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_QUERY);
    const tabletMq = window.matchMedia(TABLET_QUERY);

    const update = () => setViewport(resolveViewport());

    mobileMq.addEventListener('change', update);
    tabletMq.addEventListener('change', update);
    return () => {
      mobileMq.removeEventListener('change', update);
      tabletMq.removeEventListener('change', update);
    };
  }, []);

  return viewport;
}

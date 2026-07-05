import { useEffect, useRef } from 'react';

/** PRD M4-F32 / G11 — consult-ready measurement at ≥768px viewport. */
export const CONSULT_READY_MIN_WIDTH_PX = 768;

export function useConsultReadyBanner<TElem extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<TElem>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return undefined;
    }

    const media = window.matchMedia(`(min-width: ${CONSULT_READY_MIN_WIDTH_PX}px)`);

    const syncReady = (intersectsFully: boolean) => {
      if (media.matches && intersectsFully) {
        root.setAttribute('data-consult-ready', 'true');
      } else {
        root.removeAttribute('data-consult-ready');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }
        syncReady(entry.isIntersecting && entry.intersectionRatio >= 1);
      },
      { threshold: [0, 1] },
    );

    observer.observe(root);

    const onMediaChange = () => {
      if (!media.matches) {
        root.removeAttribute('data-consult-ready');
      }
    };

    media.addEventListener('change', onMediaChange);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', onMediaChange);
      root.removeAttribute('data-consult-ready');
    };
  }, []);

  return ref;
}

import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useConsultReadyBanner } from './useConsultReadyBanner';

function BannerProbe() {
  const ref = useConsultReadyBanner();
  return <div ref={ref} id="nc-patient-context-banner" data-testid="banner-root" />;
}

describe('useConsultReadyBanner', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    observerCallback = null;
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('768'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class MockIntersectionObserver {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }

        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets data-consult-ready when banner is fully visible at desktop width', () => {
    const { getByTestId } = render(<BannerProbe />);
    const root = getByTestId('banner-root');

    observerCallback?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(root).toHaveAttribute('data-consult-ready', 'true');
  });

  it('clears data-consult-ready when banner is not fully visible', () => {
    const { getByTestId } = render(<BannerProbe />);
    const root = getByTestId('banner-root');

    observerCallback?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    observerCallback?.(
      [{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(root).not.toHaveAttribute('data-consult-ready');
  });
});

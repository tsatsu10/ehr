import '@testing-library/jest-dom/vitest';
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { AppToaster } from '@components/AppToaster';

// jsdom does not implement scrollIntoView or focus-scroll behaviour
Element.prototype.scrollIntoView = vi.fn();

// cmdk (patient search Command) requires ResizeObserver in jsdom
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// consult-ready banner hook (M4-F32) uses IntersectionObserver
(globalThis as Record<string, unknown>).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

const toasterHost = document.createElement('div');
toasterHost.id = 'nc-test-toaster';
document.body.appendChild(toasterHost);
createRoot(toasterHost).render(
  createElement(StrictMode, null, createElement(AppToaster)),
);

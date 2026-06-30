import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement scrollIntoView or focus-scroll behaviour
Element.prototype.scrollIntoView = vi.fn();

// cmdk (patient search Command) requires ResizeObserver in jsdom
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

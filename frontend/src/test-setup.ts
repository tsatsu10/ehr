import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement scrollIntoView or focus-scroll behaviour
Element.prototype.scrollIntoView = vi.fn();

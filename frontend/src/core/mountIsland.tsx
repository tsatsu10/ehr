/**
 * Mount a React island into a Twig page.
 *
 * Pattern:
 *   <div data-island="my-island" data-props='{"foo":"bar"}'></div>
 *   <script src="…/assets/modern/my-island.js"></script>
 *
 * The island's entry file calls:
 *   mountIsland('my-island', MyIsland);
 *
 * `mountIsland` finds every matching `data-island` node on the page,
 * decodes `data-props` (HTML-attribute-escaped JSON), and renders the
 * component into each node. It is intentionally idempotent: calling it
 * twice on the same node replaces the previous root rather than
 * stacking trees.
 */

import { StrictMode, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { IslandProps } from './types';

const rootRegistry = new WeakMap<HTMLElement, Root>();

function decodeProps(node: HTMLElement): IslandProps {
  const raw = node.dataset.props;
  if (raw === undefined || raw === '') return {};
  try {
    return JSON.parse(raw) as IslandProps;
  } catch (err) {
    console.error('[oe-island] failed to parse data-props', { node, raw, err });
    return {};
  }
}

/**
 * Mount a React component into every `[data-island="<name>"]` node on the page.
 *
 * Props arrive as JSON from `data-props` (Twig-encoded); runtime type safety is
 * enforced server-side (PHP/Twig). TypeScript provides IDE prop checking inside
 * each island component, but the mount boundary itself is untyped by design.
 */
export function mountIsland(
  islandName: string,
  // Props are decoded from server-rendered JSON; `any` is intentional here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>
): void {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-island="${islandName}"]`);

  nodes.forEach((node) => {
    const existing = rootRegistry.get(node);
    if (existing !== undefined) existing.unmount();

    const root = createRoot(node);
    rootRegistry.set(node, root);

    const props = decodeProps(node);
    root.render(
      <StrictMode>
        <Component {...props} />
      </StrictMode>
    );
  });
}

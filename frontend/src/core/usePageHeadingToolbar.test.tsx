import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePageHeadingToolbar } from './usePageHeadingToolbar';

function ToolbarHarness({
  lastUpdated,
  visitDate,
  onRefresh,
}: {
  lastUpdated: Date | null;
  visitDate?: string | null;
  onRefresh: () => void;
}) {
  usePageHeadingToolbar({
    dateElementId: 'nc-test-date',
    updatedElementId: 'nc-test-updated',
    refreshButtonId: 'nc-test-refresh',
    visitDate,
    lastUpdated,
    onRefresh,
  });
  return null;
}

describe('usePageHeadingToolbar', () => {
  it('syncs date, updated time, and refresh click into Twig heading slots', async () => {
    const dateEl = document.createElement('div');
    dateEl.id = 'nc-test-date';
    document.body.appendChild(dateEl);

    const updatedEl = document.createElement('span');
    updatedEl.id = 'nc-test-updated';
    document.body.appendChild(updatedEl);

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'nc-test-refresh';
    document.body.appendChild(refreshBtn);

    const onRefresh = vi.fn();
    const updatedAt = new Date('2099-06-15T14:30:00');

    render(
      <ToolbarHarness
        lastUpdated={updatedAt}
        visitDate="2099-06-15"
        onRefresh={onRefresh}
      />,
    );

    await waitFor(() => {
      expect(dateEl.textContent).toBe('2099-06-15');
      expect(updatedEl.textContent).toMatch(/^Updated /);
    });

    refreshBtn.click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

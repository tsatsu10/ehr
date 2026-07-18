import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupChecklistCard } from './SetupChecklistCard';
import type { SetupProgressPayload } from './adminTypes';

const baseProgress: SetupProgressPayload = {
  setup_complete: false,
  score_percent: 40,
  score_threshold: 70,
  can_mark_complete: false,
  items: [
    {
      key: 'fee_lines',
      label: 'Prices set for at least 3 services',
      weight: 10,
      completed: false,
      manual: false,
      hint: 'Open the Fees tab and add prices.',
      link_tab: 'fees',
    },
    {
      key: 'g12_drill',
      label: 'Wrong-patient safety drill done',
      weight: 5,
      completed: false,
      manual: true,
      ticked: false,
      hint: 'Walk the team through the drill.',
      link_tab: null,
    },
    {
      key: 'worksheet_recorded',
      label: 'Go-live worksheet recorded',
      weight: 10,
      completed: true,
      manual: true,
      ticked: true,
      hint: 'Fill in the worksheet.',
      link_tab: null,
    },
  ],
};

const handlers = () => ({
  onMarkItem: vi.fn(),
  onUnmarkItem: vi.fn(),
  onMarkComplete: vi.fn(),
  onReopen: vi.fn(),
  onNavigateTab: vi.fn(),
});

describe('SetupChecklistCard', () => {
  it('explains the completion threshold before it is reached', () => {
    render(
      <SetupChecklistCard
        progress={baseProgress}
        markingKey={null}
        completing={false}
        reopening={false}
        {...handlers()}
      />,
    );

    expect(screen.getByText(/once you reach 70%/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark setup complete/i })).not.toBeInTheDocument();
  });

  it('offers a take-me-there link that switches tabs', () => {
    const h = handlers();
    render(
      <SetupChecklistCard
        progress={baseProgress}
        markingKey={null}
        completing={false}
        reopening={false}
        {...h}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Fees/i }));
    expect(h.onNavigateTab).toHaveBeenCalledWith('fees');
  });

  it('gives each Mark done button a per-item accessible name and shows Undo on ticked rows', () => {
    const h = handlers();
    render(
      <SetupChecklistCard
        progress={baseProgress}
        markingKey={null}
        completing={false}
        reopening={false}
        {...h}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark "Wrong-patient safety drill done" done' }));
    expect(h.onMarkItem).toHaveBeenCalledWith('g12_drill');

    fireEvent.click(screen.getByRole('button', { name: 'Untick "Go-live worksheet recorded"' }));
    expect(h.onUnmarkItem).toHaveBeenCalledWith('worksheet_recorded');
  });

  it('after completion shows residual items and a Reopen action', () => {
    const h = handlers();
    render(
      <SetupChecklistCard
        progress={{ ...baseProgress, setup_complete: true, score_percent: 85 }}
        markingKey={null}
        completing={false}
        reopening={false}
        {...h}
      />,
    );

    expect(screen.getByText('Setup complete')).toBeInTheDocument();
    // The two incomplete items stay visible instead of vanishing.
    expect(screen.getByText('Prices set for at least 3 services')).toBeInTheDocument();
    expect(screen.getByText('Wrong-patient safety drill done')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reopen setup/i }));
    expect(h.onReopen).toHaveBeenCalled();
  });
});

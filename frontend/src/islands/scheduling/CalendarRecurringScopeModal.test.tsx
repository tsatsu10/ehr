import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarRecurringScopeModal } from './CalendarRecurringScopeModal';
import { resolveSchedulingLabels } from './schedulingLabels';

const labels = resolveSchedulingLabels();

describe('CalendarRecurringScopeModal', () => {
  it('renders scope choices when open', () => {
    render(
      <CalendarRecurringScopeModal
        open
        labels={labels}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(labels.recurringScopeCurrent)).toBeInTheDocument();
    expect(screen.getByText(labels.recurringScopeFuture)).toBeInTheDocument();
    expect(screen.getByText(labels.recurringScopeAll)).toBeInTheDocument();
  });

  it('calls onSelect with scope and onCancel when dismissed', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    render(
      <CalendarRecurringScopeModal
        open
        labels={labels}
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: labels.recurringScopeFuture }));
    expect(onSelect).toHaveBeenCalledWith('future');

    fireEvent.click(screen.getByRole('button', { name: labels.cancel }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <CalendarRecurringScopeModal
        open={false}
        labels={labels}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

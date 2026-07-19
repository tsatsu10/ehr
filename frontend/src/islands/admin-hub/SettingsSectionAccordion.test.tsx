import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsSectionAccordion } from './SettingsSectionAccordion';
import type { AdminFieldSection } from './adminFieldDefs';

const sections: AdminFieldSection[] = [
  {
    title: 'First group',
    fields: [{ key: 'first_field', type: 'bool', label: 'First field' }],
  },
  {
    title: 'Second group',
    fields: [{ key: 'second_field', type: 'bool', label: 'Second field' }],
  },
];

const baseProps = {
  heading: 'Test heading',
  description: 'Test description',
  searchPlaceholder: 'Search…',
  searchAriaLabel: 'Search test',
  idPrefix: 'test',
  sections,
  sectionIcons: {},
  settings: {},
  onFieldChange: () => {},
};

describe('SettingsSectionAccordion highlight (ADM-1)', () => {
  it('opens the second section is collapsed by default', () => {
    render(<SettingsSectionAccordion {...baseProps} />);

    expect(screen.getByLabelText('First field')).toBeInTheDocument();
    expect(screen.queryByLabelText('Second field')).not.toBeInTheDocument();
  });

  it('opens a collapsed section, scrolls to, and flash-highlights the target field', async () => {
    vi.useFakeTimers();
    const scrollSpy = vi.fn();
    const onHighlightHandled = vi.fn();

    render(
      <SettingsSectionAccordion
        {...baseProps}
        highlightKey="second_field"
        onHighlightHandled={onHighlightHandled}
      />
    );

    // Section 2 is now open (React state applied synchronously on mount).
    const row = document.getElementById('nc-admin-field-row-second_field');
    expect(row).toBeInTheDocument();
    row!.scrollIntoView = scrollSpy;

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(scrollSpy).toHaveBeenCalled();
    expect(row).toHaveClass('nc-admin-field-flash');
    expect(onHighlightHandled).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('clears a stale local search query so the highlight jump can actually find its target', async () => {
    vi.useFakeTimers();
    const onHighlightHandled = vi.fn();

    const { rerender } = render(
      <SettingsSectionAccordion {...baseProps} onHighlightHandled={onHighlightHandled} />
    );

    // User had typed a local search that filters "Second group" out entirely.
    fireEvent.change(screen.getByLabelText('Search test'), { target: { value: 'first' } });
    expect(screen.queryByLabelText('Second field')).not.toBeInTheDocument();

    // A global-sidebar jump to a field in the now-hidden section arrives.
    rerender(
      <SettingsSectionAccordion
        {...baseProps}
        highlightKey="second_field"
        onHighlightHandled={onHighlightHandled}
      />
    );

    const row = document.getElementById('nc-admin-field-row-second_field');
    expect(row).toBeInTheDocument();
    row!.scrollIntoView = vi.fn();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(row).toHaveClass('nc-admin-field-flash');
    // The local search box itself is cleared, not just bypassed.
    expect(screen.getByLabelText('Search test')).toHaveValue('');

    vi.useRealTimers();
  });

  it('calls onHighlightHandled without opening anything when the key does not exist in this section set', () => {
    const onHighlightHandled = vi.fn();
    render(
      <SettingsSectionAccordion
        {...baseProps}
        highlightKey="not_a_real_key"
        onHighlightHandled={onHighlightHandled}
      />
    );

    expect(onHighlightHandled).toHaveBeenCalled();
    expect(screen.queryByLabelText('Second field')).not.toBeInTheDocument();
  });
});

describe('SettingsSectionAccordion override transparency (ADM-5)', () => {
  it('shows no override affordance when settingsOverrides is absent (global scope)', () => {
    render(<SettingsSectionAccordion {...baseProps} />);

    expect(screen.queryByText('Overridden for this clinic')).not.toBeInTheDocument();
  });

  it('shows the override badge and reset link for an overridden field, and calls onResetOverride with its key and label', () => {
    const onResetOverride = vi.fn();
    render(
      <SettingsSectionAccordion
        {...baseProps}
        settingsOverrides={{ first_field: { overridden: true, global_value: false } }}
        onResetOverride={onResetOverride}
      />
    );

    expect(screen.getByText('Overridden for this clinic')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use global value' }));
    expect(onResetOverride).toHaveBeenCalledWith('first_field', 'First field');
  });

  it('disables the reset link and shows a reverting label while that key is resetting', () => {
    render(
      <SettingsSectionAccordion
        {...baseProps}
        settingsOverrides={{ first_field: { overridden: true, global_value: false } }}
        onResetOverride={() => {}}
        resettingOverrideKey="first_field"
      />
    );

    const button = screen.getByRole('button', { name: 'Reverting…' });
    expect(button).toBeDisabled();
  });
});

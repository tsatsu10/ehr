import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AdminSidebar } from './AdminSidebar';
import type { AdminTabId } from './adminTypes';

const tabs: { id: AdminTabId; label: string }[] = [
  { id: 'queue-desks', label: 'Queue & desks' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'people', label: 'People & access' },
  { id: 'system', label: 'System' },
];

describe('AdminSidebar', () => {
  it('groups visible destinations and marks the active one', () => {
    render(<AdminSidebar tabs={tabs} activeTab="clinic" onChange={() => {}} />);

    expect(screen.getByText('Clinic', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('People & money')).toBeInTheDocument();
    // "Operations" holds only System here — Forms was filtered out of `tabs`.
    expect(screen.getByText('Operations')).toBeInTheDocument();

    const activeLink = screen.getByRole('link', { name: 'Clinic' });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Queue & desks' })).not.toHaveAttribute('aria-current');
  });

  it('drops a group heading entirely when none of its items are visible', () => {
    render(
      <AdminSidebar
        tabs={tabs.filter((tab) => tab.id !== 'system')}
        activeTab="queue-desks"
        onChange={() => {}}
      />
    );

    expect(screen.queryByText('Operations')).not.toBeInTheDocument();
  });

  it('calls onChange with the tab id on a plain click without a page navigation', () => {
    const onChange = vi.fn();
    render(<AdminSidebar tabs={tabs} activeTab="queue-desks" onChange={onChange} />);

    const link = screen.getByRole('link', { name: 'People & access' });
    fireEvent.click(link, { button: 0 });

    expect(onChange).toHaveBeenCalledWith('people');
  });

  it('leaves modified clicks (e.g. ctrl+click for a new tab) to the browser', () => {
    const onChange = vi.fn();
    render(<AdminSidebar tabs={tabs} activeTab="queue-desks" onChange={onChange} />);

    fireEvent.click(screen.getByRole('link', { name: 'People & access' }), {
      button: 0,
      ctrlKey: true,
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a warning/danger badge paired with visible text, not color alone', () => {
    render(
      <AdminSidebar
        tabs={tabs}
        activeTab="queue-desks"
        onChange={() => {}}
        badges={{ system: { tone: 'warning', label: 'Warning' } }}
      />
    );

    const badge = screen.getByText('Warning');
    expect(badge.closest('a')).toHaveTextContent('System');
    expect(badge).toHaveClass('nc-admin-sidebar__badge--warning');
  });

  it('moves focus between items with the arrow keys', () => {
    render(<AdminSidebar tabs={tabs} activeTab="queue-desks" onChange={() => {}} />);

    const first = screen.getByRole('link', { name: 'Queue & desks' });
    const second = screen.getByRole('link', { name: 'Clinic' });
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });
});

describe('AdminSidebar search (ADM-1)', () => {
  // fees/features must be in `tabs` for their search results to show —
  // AdminSidebar filters results against the visible-tabs gate.
  const searchTabs: { id: AdminTabId; label: string }[] = [
    ...tabs,
    { id: 'features', label: 'Features' },
    { id: 'fees', label: 'Fees' },
  ];

  it('replaces the grouped nav with a flat results list while searching', () => {
    render(<AdminSidebar tabs={searchTabs} activeTab="queue-desks" onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'triage' } });

    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeInTheDocument();
    expect(screen.getByText(/Enable triage desk/i)).toBeInTheDocument();
    expect(screen.getByText(/in Queue & desks/i)).toBeInTheDocument();
  });

  it('calls onSelectField and clears the query on a field result click', () => {
    const onSelectField = vi.fn();
    render(
      <AdminSidebar
        tabs={searchTabs}
        activeTab="queue-desks"
        onChange={() => {}}
        onSelectField={onSelectField}
      />
    );

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'triage' } });
    fireEvent.click(screen.getByText(/Enable triage desk/i));

    expect(onSelectField).toHaveBeenCalledWith('queue-desks', 'enable_triage');
    expect(screen.getByLabelText('Search settings')).toHaveValue('');
  });

  it('calls onSelectDestination for a destination-only result (no field-def)', () => {
    const onSelectDestination = vi.fn();
    render(
      <AdminSidebar
        tabs={searchTabs}
        activeTab="queue-desks"
        onChange={() => {}}
        onSelectDestination={onSelectDestination}
      />
    );

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'fee schedule' } });
    fireEvent.click(screen.getByText('Fees'));

    expect(onSelectDestination).toHaveBeenCalledWith('fees');
  });

  it('does not surface a result whose destination tab is gated off', () => {
    // "features" is NOT in `tabs` here (only in the wider searchTabs fixture).
    render(<AdminSidebar tabs={tabs} activeTab="queue-desks" onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'billing back office hub' } });

    expect(screen.queryByText(/Enable Billing Back Office hub/i)).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<AdminSidebar tabs={searchTabs} activeTab="queue-desks" onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'zzz-nonexistent-zzz' } });

    expect(screen.getByText(/No settings match/i)).toBeInTheDocument();
  });

  it('clears the query via the clear button and restores the grouped nav', () => {
    render(<AdminSidebar tabs={searchTabs} activeTab="queue-desks" onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'triage' } });
    fireEvent.click(screen.getByLabelText('Clear search'));

    expect(screen.getByLabelText('Search settings')).toHaveValue('');
    expect(screen.getByText('Clinic', { selector: 'p' })).toBeInTheDocument();
  });
});

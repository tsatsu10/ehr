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

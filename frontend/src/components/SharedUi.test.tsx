import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';
import { DataTable, DataTableStatusRow } from './DataTable';
import { RowActionsMenu } from './RowActionsMenu';
import { SlideOver } from './SlideOver';
import { TrendPill } from './TrendPill';
import { WidgetCard } from './WidgetCard';
import { DeskQueueStatusBar } from './DeskQueueStatusBar';

describe('DeskQueueStatusBar', () => {
  it('renders status items and refresh control', () => {
    render(
      <DeskQueueStatusBar
        ariaLabel="Test desk status"
        items={[
          { label: 'Waiting', value: 3 },
          { label: 'Done today', value: 12 },
        ]}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Test desk status/i)).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText(/Refresh status/i)).toBeInTheDocument();
  });
});

describe('WidgetCard', () => {
  it('renders title and padded body', () => {
    render(
      <WidgetCard title="Test card" bodyPad="pad">
        Body content
      </WidgetCard>
    );
    expect(screen.getByRole('heading', { name: 'Test card' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('renders header and status row', () => {
    render(
      <DataTable
        header={<tr><th>Name</th></tr>}
      >
        <DataTableStatusRow colSpan={1}><em>Loading…</em></DataTableStatusRow>
      </DataTable>
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

describe('RowActionsMenu', () => {
  it('renders action items in dropdown', () => {
    render(
      <RowActionsMenu
        label="Actions for Jane"
        items={[{ id: 'chart', label: 'Open chart', href: '/chart' }]}
      />
    );
    expect(screen.getByRole('button', { name: 'Actions for Jane' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open chart' })).toHaveAttribute('href', '/chart');
  });
});

describe('SlideOver', () => {
  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SlideOver open title="Drawer" onClose={onClose}>
        Content
      </SlideOver>
    );
    fireEvent.click(container.querySelector('.oe-nc-slide-over__backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TrendPill', () => {
  it('shows up trend', () => {
    render(<TrendPill value={12} />);
    expect(screen.getByLabelText('Up 12% vs last period')).toBeInTheDocument();
  });
});

describe('ConfirmModal', () => {
  it('renders identity banner and calls onConfirm', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal
        open
        onClose={onClose}
        title="Confirm action"
        confirmLabel="Proceed"
        onConfirm={onConfirm}
        identityBanner={(
          <IdentityConfirmBanner displayName="Jane Doe" pubpid="MRN001" queueNumber={42} />
        )}
      >
        <p>Are you sure?</p>
      </ConfirmModal>
    );
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

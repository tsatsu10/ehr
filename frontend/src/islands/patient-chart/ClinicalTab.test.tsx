import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClinicalTab } from './ClinicalTab';
import type { ClinicalData, ClinicalReferralsStrip } from './patientChartTypes';

const emptyClinical: ClinicalData = {};

function renderTab(referralsStrip: ClinicalReferralsStrip | null, data: ClinicalData = emptyClinical) {
  return render(
    <ClinicalTab
      data={data}
      referralsStrip={referralsStrip}
      labsStrip={null}
      medsStrip={null}
      loading={false}
      error={null}
      onScrollToAnchor={vi.fn()}
      pid={42}
      ajaxUrl="/ajax.php"
      csrfToken="tok"
      onRefresh={vi.fn()}
    />
  );
}

describe('ClinicalTab referrals strip', () => {
  it('shows the "Open referrals" entry point at zero referrals when the hub is reachable', () => {
    // Regression: the strip used to hide entirely when items===[], stranding the
    // only Clinical-tab path to create the first referral/letter (gap-analysis v0.1.10).
    renderTab({
      hidden: false,
      items: [],
      open_referrals_url: '/chart-depth/referrals.php?pid=42&encounter_id=9',
    });

    expect(screen.getByText('No referrals on this visit yet.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open referrals' });
    expect(link).toHaveAttribute('href', '/chart-depth/referrals.php?pid=42&encounter_id=9');
  });

  it('renders the latest referral summary when referrals exist', () => {
    renderTab({
      hidden: false,
      items: [{ label: 'Regional Cardiology Clinic', status: 'Draft', occurred_at: '10 Jul 2026' }],
      open_referrals_url: '/chart-depth/referrals.php?pid=42&encounter_id=9',
    });

    expect(
      screen.getByText('Regional Cardiology Clinic · Draft · 10 Jul 2026')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open referrals' })).toBeInTheDocument();
  });

  it('does not render the strip when it is hidden (feature off or no access)', () => {
    renderTab({ hidden: true, items: [] });

    expect(screen.queryByText('No referrals on this visit yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open referrals' })).not.toBeInTheDocument();
  });

  it('renders native Add + per-item Edit for issue sections when the editor flag is on (D4)', () => {
    renderTab(null, {
      native_issue_editor: true,
      problems: {
        type: 'medical_problem',
        anchor: 'clinical-problems',
        items: [{ id: 7, title: 'Hypertension', detail: '2020' }],
      },
    });
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    // Native affordances: an "Add" button (not a link) and a per-item "Edit" button.
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('keeps the stock editor link when the editor flag is off (D4)', () => {
    renderTab(null, {
      problems: {
        anchor: 'clinical-problems',
        editor_url: '/interface/patient_file/summary/add_edit_issue.php?issue=0&type=medical_problem',
        items: [{ id: 7, title: 'Hypertension' }],
      },
    });
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('surfaces "Other transactions" so records requests stay reachable when the stock menu is hidden (D5)', () => {
    renderTab({
      hidden: false,
      items: [],
      open_referrals_url: '/chart-depth/referrals.php?pid=42&encounter_id=9',
      stock_transactions_url: '/interface/patient_file/transaction/transactions.php?set_pid=42',
    });

    const link = screen.getByRole('link', { name: 'Other transactions' });
    expect(link).toHaveAttribute('href', '/interface/patient_file/transaction/transactions.php?set_pid=42');
  });
});

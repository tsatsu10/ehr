import { render, screen } from '@testing-library/react';
import { LabDirectPanel } from './LabDirectPanel';
import type { LabDirectIntake } from '@core/types';

const intake: LabDirectIntake = {
  enabled: true,
  has_referral: true,
  referral_required_warning: false,
  referral_view_url: '/controller.php?document&retrieve',
  can_create_orders: true,
  lab_intake_formdir: 'lab_intake',
  lab_intake_title: 'Lab intake',
  lab_intake_signed: false,
  lab_intake_started: false,
  clinical_doc_hub_enabled: true,
  order_count: 0,
};

describe('LabDirectPanel', () => {
  it('renders collapsible lab-direct status', () => {
    render(<LabDirectPanel intake={intake} />);

    expect(screen.getByText(/Lab-direct visit/i)).toBeInTheDocument();
    expect(screen.getByText(/Not started/i)).toBeInTheDocument();
  });
});

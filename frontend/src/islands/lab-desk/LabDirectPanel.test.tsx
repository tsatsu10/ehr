import { render, screen, fireEvent } from '@testing-library/react';
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
  it('renders intake actions and referral link', () => {
    const onOpenLabIntake = vi.fn();
    const onCreateOrder = vi.fn();

    render(
      <LabDirectPanel
        intake={intake}
        inLab
        onOpenLabIntake={onOpenLabIntake}
        onCreateOrder={onCreateOrder}
      />,
    );

    expect(screen.getByText(/Lab-direct intake/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View referral on file/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start lab intake/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create lab order/i }));
    expect(onOpenLabIntake).toHaveBeenCalled();
    expect(onCreateOrder).toHaveBeenCalled();
  });
});

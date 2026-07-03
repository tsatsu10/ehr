import { render, screen } from '@testing-library/react';
import { PharmacyWalkinPanel } from './PharmacyWalkinPanel';
import type { PharmacyWalkinTriage } from '@core/types';

const triage: PharmacyWalkinTriage = {
  enabled: true,
  doctor_available: true,
  roster_enabled: true,
  allergies_undocumented: false,
  dispense_outcomes: ['otc_dispensed', 'external_rx_dispensed'],
  non_dispense_outcomes: ['rx_required_refer_to_opd', 'rx_required_patient_declined'],
  can_refer_to_opd: true,
  can_close_without_dispense: true,
  can_dispense: true,
  can_record_no_doctor: false,
};

describe('PharmacyWalkinPanel', () => {
  it('renders dispense and close-without-dispense actions', () => {
    render(
      <PharmacyWalkinPanel
        triage={triage}
        selectedOutcome={null}
        onSelectOutcome={() => {}}
        onCloseWithoutDispense={() => {}}
      />,
    );

    expect(screen.getByText(/Pharmacy walk-in triage/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OTC dispensed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refer to OPD/i })).toBeInTheDocument();
  });

  it('disables dispense actions when walk-in dispense ACL is denied', () => {
    render(
      <PharmacyWalkinPanel
        triage={{ ...triage, can_dispense: false }}
        selectedOutcome={null}
        onSelectOutcome={() => {}}
        onCloseWithoutDispense={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /OTC dispensed/i })).toBeDisabled();
  });
});

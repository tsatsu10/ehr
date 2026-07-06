import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PharmacyExternalRxPanel } from './PharmacyExternalRxPanel';
import type { PharmacyExternalRxStatus } from '@core/types';

const baseStatus: PharmacyExternalRxStatus = {
  fields: {
    prescriber_name: '',
    prescriber_reg_id: '',
    rx_date: '',
  },
  valid: false,
  missing: ['prescriber_name', 'prescriber_reg_id', 'rx_date'],
  field_errors: {},
  max_age_days: 730,
  pharmacy_service_formdir: 'pharmacy_service',
  pharmacy_service_title: 'Pharmacy service note',
  pharmacy_service_started: false,
  clinical_doc_hub_enabled: true,
};

describe('PharmacyExternalRxPanel', () => {
  it('shows warning when metadata is incomplete', () => {
    render(<PharmacyExternalRxPanel status={baseStatus} />);

    expect(screen.getByText(/External paper Rx/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete required fields on the service note/i)).toBeInTheDocument();
  });

  it('shows complete badge when metadata is valid', () => {
    render(
      <PharmacyExternalRxPanel
        status={{
          ...baseStatus,
          valid: true,
          missing: [],
          fields: {
            prescriber_name: 'Dr Jane Doe',
            prescriber_reg_id: 'MD-12345',
            rx_date: '2026-01-15',
          },
        }}
      />,
    );

    expect(screen.getByText('External Rx metadata complete')).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('shows warning and opens pharmacy service note', () => {
    const onOpenPharmacyService = vi.fn();

    render(
      <PharmacyExternalRxPanel
        status={baseStatus}
        onOpenPharmacyService={onOpenPharmacyService}
      />,
    );

    expect(screen.getByText(/External paper Rx metadata/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start pharmacy service note/i }));
    expect(onOpenPharmacyService).toHaveBeenCalled();
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
        onOpenPharmacyService={() => {}}
      />,
    );

    expect(screen.getByText('External Rx metadata complete')).toBeInTheDocument();
  });
});

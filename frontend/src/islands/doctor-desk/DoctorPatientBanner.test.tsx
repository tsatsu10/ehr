import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DoctorPatientBanner } from './DoctorPatientBanner';
import type { DoctorVisit, PatientPreview } from '@core/types';

function preview(overrides: Partial<PatientPreview> = {}): PatientPreview {
  return {
    identity: { pid: 12, pubpid: 'MRN012', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' },
    completion: { score: 90, billing_threshold: 70 },
    ...overrides,
  } as PatientPreview;
}

function visit(overrides: Partial<DoctorVisit> = {}): DoctorVisit {
  return {
    id: 7,
    pid: 12,
    encounter: 99,
    queue_number: '3',
    state: 'with_doctor',
    row_version: 1,
    ...overrides,
  } as DoctorVisit;
}

describe('DoctorPatientBanner', () => {
  it('shows the encounter number and a "no vitals" hint when none are recorded today', () => {
    render(
      <DoctorPatientBanner
        preview={preview()}
        visit={visit()}
        signMeta={{ encounter_signed: true, require_esign_before_complete_consult: false }}
        slim
      />,
    );
    expect(screen.getByText(/Encounter #99/)).toBeInTheDocument();
    expect(screen.getByText('No vitals today')).toBeInTheDocument();
  });

  it('shows today\'s vitals summary when present', () => {
    render(
      <DoctorPatientBanner
        preview={preview({ vitals_today: { summary: 'BP 120/80' } } as never)}
        visit={visit()}
        signMeta={{ encounter_signed: true, require_esign_before_complete_consult: false }}
        slim
      />,
    );
    expect(screen.getByText('BP 120/80')).toBeInTheDocument();
  });

  it('flags an abnormal vitals badge when vitals_abnormal_today is set', () => {
    render(
      <DoctorPatientBanner
        preview={preview({ vitals_today: { summary: 'BP 190/110', vitals_abnormal_today: true } } as never)}
        visit={visit()}
        signMeta={{ encounter_signed: true, require_esign_before_complete_consult: false }}
        slim
      />,
    );
    expect(screen.getByText('Vitals abnormal')).toBeInTheDocument();
  });

  it('renders the documentation status chip through to Signed', () => {
    render(
      <DoctorPatientBanner
        preview={preview()}
        visit={visit()}
        signMeta={{ encounter_signed: true, require_esign_before_complete_consult: false }}
        slim
      />,
    );
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('renders the full (non-slim) layout without crashing', () => {
    render(
      <DoctorPatientBanner
        preview={preview()}
        visit={visit()}
        signMeta={{ encounter_signed: false, require_esign_before_complete_consult: false }}
      />,
    );
    expect(screen.getByText(/Encounter #99/)).toBeInTheDocument();
  });
});

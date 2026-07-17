import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClinicTab } from './tabs/ClinicTab';
import type { FacilityRow } from './adminTypes';

const clinic: FacilityRow = {
  id: 3,
  name: 'Main Clinic',
  phone: '0244000000',
  email: 'clinic@example.com',
  website: 'https://example.com',
  street: '12 Test Street',
  city: 'Accra',
  state: 'Greater Accra',
  postal_code: '00233',
  country_code: 'Ghana',
  color: '#99FFFF',
  service_location: true,
  billing_location: true,
  inactive: false,
};

const otherFacility: FacilityRow = { ...clinic, id: 9, name: 'Other Branch', city: 'Kumasi' };

function renderTab(overrides: Partial<React.ComponentProps<typeof ClinicTab>> = {}) {
  const onEditFacility = vi.fn();
  render(
    <ClinicTab
      settings={{}}
      cashProfile={{ applied: false }}
      cashProfileApplying={false}
      reconciliationStatus="Last run: none yet"
      reconciliationRunning={false}
      facilities={[clinic, otherFacility]}
      currentFacilityId={3}
      onFieldChange={() => {}}
      onApplyCashProfile={() => {}}
      onRunReconciliation={() => {}}
      onEditFacility={onEditFacility}
      {...overrides}
    />,
  );
  return { onEditFacility };
}

describe('ClinicTab facility summary', () => {
  it('shows only the current clinic details, not a list of every facility', () => {
    renderTab();
    expect(screen.getByText('Main Clinic')).toBeInTheDocument();
    // The other facility must NOT be rendered — this is a single-clinic editor now.
    expect(screen.queryByText('Other Branch')).not.toBeInTheDocument();
    // No "Add facility" affordance.
    expect(screen.queryByRole('button', { name: /add facility/i })).not.toBeInTheDocument();
  });

  it('composes the address from its parts', () => {
    renderTab();
    expect(
      screen.getByText('12 Test Street, Accra, Greater Accra, 00233, Ghana'),
    ).toBeInTheDocument();
  });

  it('edits the current clinic when Edit clinic details is clicked', () => {
    const { onEditFacility } = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Edit clinic details' }));
    expect(onEditFacility).toHaveBeenCalledWith(expect.objectContaining({ id: 3, name: 'Main Clinic' }));
  });

  it('falls back to an empty state when no facility record is available', () => {
    renderTab({ facilities: [] });
    expect(screen.getByText('Clinic details unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit clinic details' })).not.toBeInTheDocument();
  });
});

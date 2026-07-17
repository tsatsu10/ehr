import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FacilityModal } from './modals/FacilityModal';
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

describe('FacilityModal', () => {
  it('pre-fills fields when editing an existing clinic', () => {
    render(
      <FacilityModal open row={clinic} saving={false} error={null} onClose={() => {}} onSave={() => {}} />,
    );

    expect(screen.getByLabelText('Facility name')).toHaveValue('Main Clinic');
    expect(screen.getByLabelText('Phone')).toHaveValue('0244000000');
    expect(screen.getByLabelText('City')).toHaveValue('Accra');
    expect(screen.getByRole('button', { name: 'Save facility' })).toBeEnabled();
  });

  it('requires a name and calls onSave with the edited values', () => {
    const onSave = vi.fn();
    render(
      <FacilityModal open row={clinic} saving={false} error={null} onClose={() => {}} onSave={onSave} />,
    );

    const nameInput = screen.getByLabelText('Facility name');
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save facility' })).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'Renamed Clinic' } });
    const saveButton = screen.getByRole('button', { name: 'Save facility' });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, name: 'Renamed Clinic', city: 'Accra' }),
    );
  });

  it('trims whitespace off the name before saving', () => {
    const onSave = vi.fn();
    render(
      <FacilityModal open row={clinic} saving={false} error={null} onClose={() => {}} onSave={onSave} />,
    );

    fireEvent.change(screen.getByLabelText('Facility name'), { target: { value: '  Padded Name  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save facility' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Padded Name' }));
  });

  it('shows the header as an edit action and renders nothing when closed', () => {
    const { rerender } = render(
      <FacilityModal open row={clinic} saving={false} error={null} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.getByText('Edit clinic details')).toBeInTheDocument();

    rerender(
      <FacilityModal open={false} row={clinic} saving={false} error={null} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.queryByText('Edit clinic details')).not.toBeInTheDocument();
  });
});

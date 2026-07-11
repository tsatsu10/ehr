import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DirectoryModal } from './modals/DirectoryModal';
import type { DirectoryContactType } from './adminTypes';

const types: DirectoryContactType[] = [
  { option_id: 'spe', title: 'Specialist', is_company: false },
  { option_id: 'external_org', title: 'External Organization', is_company: true },
];

describe('DirectoryModal', () => {
  it('requires a last name for a person-centric type and calls onSave', () => {
    const onSave = vi.fn();
    render(
      <DirectoryModal
        open
        row={null}
        types={types}
        saving={false}
        error={null}
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save contact' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Owusu' } });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ abook_type: 'spe', lname: 'Owusu' }));
  });

  it('swaps to an organization-name field for a company-centric type', () => {
    const onSave = vi.fn();
    render(
      <DirectoryModal
        open
        row={null}
        types={types}
        saving={false}
        error={null}
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('External Organization'));

    expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Organization name'), {
      target: { value: 'Regional Teaching Hospital' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ abook_type: 'external_org', organization: 'Regional Teaching Hospital' }),
    );
  });

  it('pre-fills fields when editing an existing row', () => {
    render(
      <DirectoryModal
        open
        row={{
          id: 5,
          abook_type: 'spe',
          type_label: 'Specialist',
          is_company: false,
          organization: '',
          title: 'Dr.',
          fname: 'Ama',
          lname: 'Owusu',
          display_name: 'Dr. Ama Owusu',
          phone: '0244000000',
          fax: '',
          email: '',
          notes: '',
        }}
        types={types}
        saving={false}
        error={null}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByLabelText('Last name')).toHaveValue('Owusu');
    expect(screen.getByLabelText('Phone')).toHaveValue('0244000000');
    expect(screen.getByRole('button', { name: 'Save contact' })).toBeEnabled();
  });
});

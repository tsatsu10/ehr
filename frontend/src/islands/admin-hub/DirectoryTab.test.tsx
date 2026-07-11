import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DirectoryTab } from './tabs/DirectoryTab';
import type { DirectoryContactRow, DirectoryContactType } from './adminTypes';

const types: DirectoryContactType[] = [
  { option_id: 'spe', title: 'Specialist', is_company: false },
  { option_id: 'external_org', title: 'External Organization', is_company: true },
];

const contacts: DirectoryContactRow[] = [
  {
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
    email: 'ama@example.com',
    notes: '',
  },
  {
    id: 6,
    abook_type: 'external_org',
    type_label: 'External Organization',
    is_company: true,
    organization: 'Regional Teaching Hospital',
    title: '',
    fname: '',
    lname: '',
    display_name: 'Regional Teaching Hospital',
    phone: '',
    fax: '',
    email: '',
    notes: '',
  },
];

describe('DirectoryTab', () => {
  it('renders contacts with their type and lets add/edit/delete fire', () => {
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <DirectoryTab contacts={contacts} types={types} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />,
    );

    expect(screen.getByText('Dr. Ama Owusu')).toBeInTheDocument();
    expect(screen.getByText('Regional Teaching Hospital')).toBeInTheDocument();
    expect(screen.getAllByText('Specialist').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(onAdd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(onEdit).toHaveBeenCalledWith(contacts[0]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    expect(onDelete).toHaveBeenCalledWith(contacts[1]);
  });

  it('filters by type', () => {
    render(
      <DirectoryTab contacts={contacts} types={types} onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'external_org' } });

    expect(screen.queryByText('Dr. Ama Owusu')).not.toBeInTheDocument();
    expect(screen.getByText('Regional Teaching Hospital')).toBeInTheDocument();
  });

  it('shows the empty state when there are no contacts', () => {
    render(<DirectoryTab contacts={[]} types={types} onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />);

    expect(screen.getByText('No directory contacts yet')).toBeInTheDocument();
  });
});

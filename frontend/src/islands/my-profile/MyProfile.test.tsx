import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MyProfile } from './MyProfile';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({
    id: 1,
    username: 'dr.smith',
    fname: 'Ada',
    lname: 'Smith',
    mname: '',
    email: 'ada@clinic.test',
    display_name: 'Ada Smith',
    initials: 'AS',
    active: true,
    authorized: true,
    facility_id: 3,
    facility_name: 'Main Clinic',
    groups: [{ value: 'Physicians', label: 'Physicians' }],
    role_template: 'doctor',
    role_template_label: 'Doctor',
    desks: ['Doctor'],
    active_role: {
      aco: 'new_doctor',
      label: 'Doctor',
      desk_label: "Doctor Ada's desk",
      accent: 'doctor',
    },
    available_roles: [
      {
        aco: 'new_doctor',
        label: 'Doctor',
        desk_label: "Doctor Ada's desk",
        accent: 'doctor',
        is_active: true,
      },
    ],
    can_change_password: true,
    secure_password: false,
  }),
}));

describe('MyProfile', () => {
  it('renders identity hero and account form', async () => {
    render(<MyProfile ajaxUrl="/ajax.php" csrfToken="token" />);
    expect(await screen.findByText('Ada Smith')).toBeInTheDocument();
    expect(screen.getAllByText("Doctor Ada's desk").length).toBeGreaterThan(0);
    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Last name')).toHaveValue('Smith');
    expect(screen.getByRole('button', { name: 'Save details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeInTheDocument();
  });
});

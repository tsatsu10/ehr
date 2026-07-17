import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileInfoPanel } from './ProfileInfoPanel';

describe('ProfileInfoPanel', () => {
  it('shows the demographic values already in the registration data', () => {
    render(
      <ProfileInfoPanel
        data={{
          section_1: { fname: 'Ama', lname: 'Mensah', sex: 'Female', phone: '0244 123 456', DOB: '1990-05-14', national_id: 'GHA-123' },
          section_2: { street: '12 Market Rd', email: 'ama@example.com' },
          section_3: { blood_group: 'O+', occupation: 'Trader' },
          section_4: { insurance_label: 'Cash' },
        }}
      />,
    );
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument();
    expect(screen.getByText('14/05/1990')).toBeInTheDocument(); // DD/MM/YYYY
    expect(screen.getByText('0244 123 456')).toBeInTheDocument();
    expect(screen.getByText('12 Market Rd')).toBeInTheDocument();
    expect(screen.getByText('O+')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is recorded', () => {
    render(<ProfileInfoPanel data={null} />);
    expect(screen.getByText('No details recorded yet.')).toBeInTheDocument();
  });
});

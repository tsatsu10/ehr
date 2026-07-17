import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DoctorTeamRoster } from './DoctorTeamRoster';

describe('DoctorTeamRoster', () => {
  it('renders nothing while loading with no doctors yet', () => {
    const { container } = render(<DoctorTeamRoster doctors={[]} myUserId={5} loading />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no doctors and loading is finished', () => {
    const { container } = render(<DoctorTeamRoster doctors={[]} myUserId={5} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('summarizes how many of the team are taking patients', () => {
    render(
      <DoctorTeamRoster
        doctors={[
          { user_id: 5, display_name: 'Me', taking_patients: true, queue_load: 2 },
          { user_id: 6, display_name: 'Other', taking_patients: false, queue_load: 0 },
        ]}
        myUserId={5}
        loading={false}
      />,
    );
    expect(screen.getByText('1 of 2 taking patients')).toBeInTheDocument();
  });

  it('marks the current user with "(you)" and shows queue load for active doctors', () => {
    render(
      <DoctorTeamRoster
        doctors={[{ user_id: 5, display_name: 'Me', taking_patients: true, queue_load: 3 }]}
        myUserId={5}
        loading={false}
      />,
    );
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.getByText(/3 in queue/)).toBeInTheDocument();
  });

  it('shows Paused for doctors not taking patients', () => {
    render(
      <DoctorTeamRoster
        doctors={[{ user_id: 6, display_name: 'Other', taking_patients: false, queue_load: 0 }]}
        myUserId={5}
        loading={false}
      />,
    );
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});

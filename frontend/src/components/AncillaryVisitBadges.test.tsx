import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AncillaryVisitBadges } from './AncillaryVisitBadges';

describe('AncillaryVisitBadges', () => {
  it('renders known ancillary badges', () => {
    render(
      <AncillaryVisitBadges
        badges={['lab_direct', 'referral_on_file', 'referred_to_opd']}
      />,
    );

    expect(screen.getByText('Direct lab')).toBeInTheDocument();
    expect(screen.getByText('Referral on file')).toBeInTheDocument();
    expect(screen.getByText('Referred to OPD')).toBeInTheDocument();
  });

  it('ignores unknown badge keys', () => {
    render(<AncillaryVisitBadges badges={['lab_direct', 'unknown_badge']} />);

    expect(screen.getByText('Direct lab')).toBeInTheDocument();
    expect(screen.queryByText('unknown_badge')).not.toBeInTheDocument();
  });

  it('renders nothing when badges empty', () => {
    const { container } = render(<AncillaryVisitBadges badges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

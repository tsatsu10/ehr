import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReferralUploadField } from './ReferralUploadField';

describe('ReferralUploadField', () => {
  it('renders upload control for lab-direct start visit', () => {
    render(
      <ReferralUploadField
        referralRequired
        documentId={null}
        filename={null}
        onSelectFile={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText(/Referral document \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload referral/i })).toBeInTheDocument();
    expect(screen.getByText(/configured to expect a referral/i)).toBeInTheDocument();
  });

  it('shows attached filename when document is on file', () => {
    render(
      <ReferralUploadField
        documentId={42}
        filename="lab-referral.pdf"
        onSelectFile={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('lab-referral.pdf')).toBeInTheDocument();
    expect(screen.getByText('On file')).toBeInTheDocument();
  });
});

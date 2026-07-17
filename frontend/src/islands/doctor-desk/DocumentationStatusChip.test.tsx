import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentationStatusChip } from './DocumentationStatusChip';

describe('DocumentationStatusChip', () => {
  it('shows Signed when the encounter is signed, regardless of other fields', () => {
    render(
      <DocumentationStatusChip
        encounterSigned
        requireSign
        documentationStatus={{ unsigned_required: [{ title: 'Vitals' }] } as never}
      />,
    );
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('lists unsigned required forms with a chief-complaint preview hint', () => {
    render(
      <DocumentationStatusChip
        encounterSigned={false}
        requireSign
        documentationStatus={{
          unsigned_required: [{ title: 'Vitals' }, { title: 'Consult note' }],
          encounter_note_preview: { cc_preview: 'Headache' },
        } as never}
      />,
    );
    expect(screen.getByText(/Unsigned: Vitals, Consult note/)).toBeInTheDocument();
    expect(screen.getByText(/Headache/)).toBeInTheDocument();
  });

  it('falls back to a problem-count preview hint when there is no chief complaint', () => {
    render(
      <DocumentationStatusChip
        encounterSigned={false}
        requireSign={false}
        documentationStatus={{
          unsigned_required: [{ title: 'Vitals' }],
          encounter_note_preview: { problem_count: 3 },
        } as never}
      />,
    );
    expect(screen.getByText(/3 problems/)).toBeInTheDocument();
  });

  it('shows a draft preview when nothing is unsigned but a note preview exists', () => {
    render(
      <DocumentationStatusChip
        encounterSigned={false}
        requireSign={false}
        documentationStatus={{
          unsigned_required: [],
          encounter_note_preview: { cc_preview: 'Follow-up', signed: false },
        } as never}
      />,
    );
    expect(screen.getByText(/Draft · Follow-up/)).toBeInTheDocument();
  });

  it('shows the blocking message when signing is required and nothing else applies', () => {
    render(<DocumentationStatusChip encounterSigned={false} requireSign documentationStatus={null} />);
    expect(screen.getByText('Unsigned — sign before complete')).toBeInTheDocument();
  });

  it('shows the payment-blocked message when signing is not required', () => {
    render(<DocumentationStatusChip encounterSigned={false} requireSign={false} documentationStatus={null} />);
    expect(screen.getByText('Unsigned — payment blocked')).toBeInTheDocument();
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsTab } from './DocumentsTab';
import * as api from './documentsApi';
import type { DocumentsListResponse, PatientDocument } from './patientChartTypes';

vi.mock('./documentsApi');

const mockedApi = vi.mocked(api);

const sampleDocs: PatientDocument[] = [
  {
    id: 7,
    name: 'referral-letter.pdf',
    mimetype: 'application/pdf',
    size: 24576,
    date: '2026-07-10',
    category_id: 3,
    category_name: 'Referrals',
    uploader: 'Ama Owusu',
    view_url: '/controller.php?document&retrieve&patient_id=42&document_id=7&as_file=false',
  },
];

function listResponse(documents: PatientDocument[]): DocumentsListResponse {
  return { documents, total: documents.length, offset: 0, page_size: 25 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.fetchDocumentCategories.mockResolvedValue({
    categories: [
      { id: 3, name: 'Referrals' },
      { id: 5, name: 'Lab Report' },
    ],
  });
});

describe('DocumentsTab', () => {
  it('renders the documents table from documents.list', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse(sampleDocs));
    render(<DocumentsTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);

    expect(await screen.findByText('referral-letter.pdf')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Referrals' })).toBeInTheDocument();
    expect(screen.getByText('10/07/2026')).toBeInTheDocument();
    expect(screen.getByText('Ama Owusu')).toBeInTheDocument();
    expect(mockedApi.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ ajaxUrl: '/ajax.php' }),
      42,
      0,
    );
  });

  it('shows the empty state when there are no documents', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse([]));
    render(<DocumentsTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);

    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
  });

  it('uploads a chosen file via documents.upload then reloads', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse([]));
    mockedApi.uploadDocument.mockResolvedValue({ document_id: 9, filename: 'scan.pdf' });
    render(<DocumentsTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);
    await screen.findByText('No documents yet');

    const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('Choose a file to upload');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(mockedApi.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({ ajaxUrl: '/ajax.php' }),
        42,
        3,
        file,
      ),
    );
    // Reloaded after upload (initial load + post-upload reload).
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('deletes a document after confirmation', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse(sampleDocs));
    mockedApi.deleteDocument.mockResolvedValue({});
    render(<DocumentsTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);
    await screen.findByText('referral-letter.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Delete referral-letter.pdf' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete document' }));

    await waitFor(() =>
      expect(mockedApi.deleteDocument).toHaveBeenCalledWith(
        expect.objectContaining({ ajaxUrl: '/ajax.php' }),
        42,
        7,
      ),
    );
  });
});

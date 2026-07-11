import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnfiledDocumentsLens } from './UnfiledDocumentsLens';
import * as api from '@islands/patient-chart/documentsApi';
import type { DocumentsListResponse, PatientDocument } from '@islands/patient-chart/patientChartTypes';

vi.mock('@islands/patient-chart/documentsApi');

vi.mock('@components/PatientSearchDropdown', () => ({
  PatientSearchDropdown: ({
    onSelectPatient,
  }: {
    onSelectPatient: (pid: number, row?: { pid: number; display_name: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectPatient(99, { pid: 99, display_name: 'Ama Owusu' })}
    >
      Pick Ama Owusu
    </button>
  ),
}));

const mockedApi = vi.mocked(api);

const sampleDocs: PatientDocument[] = [
  {
    id: 11,
    name: 'intake-batch-scan.pdf',
    mimetype: 'application/pdf',
    size: 10240,
    date: '2026-07-11',
    category_id: 1,
    category_name: 'General',
    uploader: 'Kofi Mensah',
    view_url: '/controller.php?document&retrieve&patient_id=0&document_id=11&as_file=false',
  },
];

function listResponse(documents: PatientDocument[]): DocumentsListResponse {
  return { documents, total: documents.length, offset: 0, page_size: 25 };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnfiledDocumentsLens', () => {
  it('renders unfiled documents from documents.unfiled_list', async () => {
    mockedApi.listUnfiledDocuments.mockResolvedValue(listResponse(sampleDocs));
    render(<UnfiledDocumentsLens ajaxUrl="/ajax.php" csrfToken="token" />);

    expect(await screen.findByText('intake-batch-scan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();
    expect(mockedApi.listUnfiledDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ ajaxUrl: '/ajax.php' }),
      0,
    );
  });

  it('shows the empty state when nothing is unfiled', async () => {
    mockedApi.listUnfiledDocuments.mockResolvedValue(listResponse([]));
    render(<UnfiledDocumentsLens ajaxUrl="/ajax.php" csrfToken="token" />);

    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument();
  });

  it('assigns a document to a patient and removes it from the list', async () => {
    mockedApi.listUnfiledDocuments
      .mockResolvedValueOnce(listResponse(sampleDocs))
      .mockResolvedValueOnce(listResponse([]));
    mockedApi.assignDocumentToPatient.mockResolvedValue({});
    render(<UnfiledDocumentsLens ajaxUrl="/ajax.php" csrfToken="token" />);
    await screen.findByText('intake-batch-scan.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Assign…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick Ama Owusu' }));

    await waitFor(() =>
      expect(mockedApi.assignDocumentToPatient).toHaveBeenCalledWith(
        expect.objectContaining({ ajaxUrl: '/ajax.php' }),
        11,
        99,
      ),
    );
    await waitFor(() => expect(mockedApi.listUnfiledDocuments).toHaveBeenCalledTimes(2));
  });
});

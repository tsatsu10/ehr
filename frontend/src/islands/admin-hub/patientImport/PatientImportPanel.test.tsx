import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientImportPanel } from './PatientImportPanel';

const oeFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@core/oeFetch', () => ({ oeFetch: oeFetchMock }));

const CSV = 'First Name,Surname,Date of Birth\nAma,Mensah,12/03/1988\nKwame,Boateng,01/01/1970\n';

describe('PatientImportPanel', () => {
  it('walks upload → match → check → import', async () => {
    oeFetchMock.mockResolvedValue({
      results: [
        { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
        { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
      ],
      summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
      stopped: false,
      accepted_keys: { name_dob: ['ama|mensah|1988-03-12'], name_phone: [], national_id: [] },
    });

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={CSV} />);

    // Auto-matched columns are shown on the match step.
    expect(await screen.findByText(/match columns/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));

    const willImportTile = (await screen.findByText('Will import')).closest('.nc-import-stat-tile');
    expect(willImportTile).not.toBeNull();
    await waitFor(() => expect(within(willImportTile as HTMLElement).getByText('2')).toBeInTheDocument());
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.objectContaining({ dry_run: 1 }) })
    );
    // The client no longer decides which facility to import into — the
    // session on the server side is the sole source of truth (Task B).
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.not.objectContaining({ facility_id: expect.anything() }) })
    );
    // M2: the first (and, with only one chunk here, only) chunk request must
    // not carry a prior_keys key — there's nothing accumulated yet.
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.not.objectContaining({ prior_keys: expect.anything() }) })
    );
  });

  it('blocks Continue until first and last name are mapped', async () => {
    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={'a,b\n1,2\n'} />);
    const btn = await screen.findByRole('button', { name: /check file/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/first name and last name/i)).toBeInTheDocument();
  });

  it('shows the real partial results — not the stale dry-run preview — after a commit failure', async () => {
    // The dry-run ("Check file") call succeeds and predicts 2 importable rows.
    // The real commit call (after confirming "Import") then fails outright,
    // so nothing was actually imported.
    oeFetchMock
      .mockResolvedValueOnce({
        results: [
          { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
          { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
        ],
        summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
        stopped: false,
        accepted_keys: { name_dob: [], name_phone: [], national_id: [] },
      })
      .mockRejectedValueOnce(new Error('Connection lost'));

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={CSV} />);

    fireEvent.click(await screen.findByRole('button', { name: /check file/i }));

    const importTrigger = await screen.findByRole('button', { name: /import 2 patients/i });
    fireEvent.click(importTrigger);

    const confirmButton = await screen.findByRole('button', { name: /^import$/i });
    fireEvent.click(confirmButton);

    // The failure is surfaced...
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection lost/i);

    // ...and the Done screen reflects that ZERO rows actually committed before
    // the failure, not the dry-run's "2 will import" prediction.
    const importedTile = (await screen.findByText('Imported')).closest('.nc-import-stat-tile');
    expect(importedTile).not.toBeNull();
    expect(within(importedTile as HTMLElement).getByText('0')).toBeInTheDocument();
  });

  it('M1: shows the server stop reason and that chunk\'s real results when the breaker trips mid-commit', async () => {
    // The dry-run predicts both rows will import. The commit chunk then comes
    // back with stopped=true (server-side breaker trip) instead of throwing —
    // one row made it in before the trip, the other errored.
    oeFetchMock
      .mockResolvedValueOnce({
        results: [
          { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
          { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
        ],
        summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
        stopped: false,
        accepted_keys: { name_dob: [], name_phone: [], national_id: [] },
      })
      .mockResolvedValueOnce({
        results: [
          { row_number: 2, status: 'imported', reason: '', name: 'Ama Mensah', pid: 501 },
          { row_number: 3, status: 'error', reason: 'Could not save this patient — see server log', name: 'Kwame Boateng', pid: null },
        ],
        summary: { processed: 2, ok: 1, duplicates: 0, errors: 1 },
        stopped: true,
        stopped_reason: 'Import stopped after repeated save failures — fix the reported rows and re-run',
        accepted_keys: { name_dob: ['ama|mensah|1988-03-12'], name_phone: [], national_id: [] },
      });

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={CSV} />);

    fireEvent.click(await screen.findByRole('button', { name: /check file/i }));

    const importTrigger = await screen.findByRole('button', { name: /import 2 patients/i });
    fireEvent.click(importTrigger);

    const confirmButton = await screen.findByRole('button', { name: /^import$/i });
    fireEvent.click(confirmButton);

    // The server's stop reason is shown, not a generic network-error message.
    expect(await screen.findByRole('alert')).toHaveTextContent(/repeated save failures/i);

    // The tile reflects the chunk's real, partial results — one imported.
    const importedTile = (await screen.findByText('Imported')).closest('.nc-import-stat-tile');
    expect(importedTile).not.toBeNull();
    expect(within(importedTile as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('L7: warns and blocks Check file when two columns are mapped to the same field', async () => {
    render(
      <PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={'Col1,Col2,Col3\nA,B,C\n'} />
    );

    fireEvent.click(await screen.findByRole('combobox', { name: /import col1 as/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'First name' }));

    fireEvent.click(await screen.findByRole('combobox', { name: /import col2 as/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Last name' }));

    const checkFileButton = await screen.findByRole('button', { name: /check file/i });
    expect(checkFileButton).toBeEnabled();

    // Map Col3 to First name too — now the same field is used twice.
    fireEvent.click(await screen.findByRole('combobox', { name: /import col3 as/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'First name' }));

    expect(await screen.findByText(/same field/i)).toBeInTheDocument();
    expect(checkFileButton).toBeDisabled();
  });
});

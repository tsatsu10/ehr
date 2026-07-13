import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@components/DataTable';
import { TableCell, TableHead, TableRow } from '@components/ui/table';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { showDeskToast } from '@components/deskToast';
import { assignDocumentToPatient, listUnfiledDocuments } from '@islands/patient-chart/documentsApi';
import { formatBytes, formatDocDate } from '@islands/patient-chart/documentsUi';
import type { PatientDocument } from '@islands/patient-chart/patientChartTypes';
import type { PatientSearchRow } from '@core/types';

interface UnfiledDocumentsLensProps {
  ajaxUrl: string;
  csrfToken: string;
}

export function UnfiledDocumentsLens({ ajaxUrl, csrfToken }: UnfiledDocumentsLensProps) {
  const ctx = { ajaxUrl, csrfToken };
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUnfiledDocuments(ctx, nextOffset);
      setDocuments(data.documents);
      setTotal(data.total);
      setOffset(data.offset);
      setPageSize(data.page_size);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load unfiled documents');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssign = async (doc: PatientDocument, row: PatientSearchRow) => {
    setSavingId(doc.id);
    try {
      await assignDocumentToPatient(ctx, doc.id, row.pid);
      showDeskToast(`"${doc.name}" filed to ${row.display_name}`, 'success');
      setAssigningId(null);
      await load(offset);
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Could not assign document', 'danger');
    } finally {
      setSavingId(null);
    }
  };

  const hasPager = total > pageSize;

  return (
    <div className="nc-reporthub-unfiled">
      {error && (
        <div className={deskCalloutClass('error', 'mb-3')} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">Loading unfiled documents…</p>
      ) : documents.length === 0 ? (
        <div className="nc-reporthub-empty">
          <p className="nc-reporthub-empty-title mb-1">Nothing waiting</p>
          <p className="nc-reporthub-empty-text mb-0">
            Every scanned document has a patient. New batch scans without a patient attached will
            show up here.
          </p>
        </div>
      ) : (
        <>
          <DataTable
            header={
              <TableRow>
                <TableHead scope="col">Document</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col">Scanned</TableHead>
                <TableHead scope="col">Uploaded by</TableHead>
                <TableHead scope="col" className="text-right">
                  Assign to patient
                </TableHead>
              </TableRow>
            }
          >
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <a href={doc.view_url} target="_blank" rel="noreferrer">
                    {doc.name}
                  </a>
                  <div className="text-[var(--oe-nc-text-muted)] text-xs">{formatBytes(doc.size)}</div>
                </TableCell>
                <TableCell>{doc.category_name || '—'}</TableCell>
                <TableCell>{formatDocDate(doc.date)}</TableCell>
                <TableCell>{doc.uploader || '—'}</TableCell>
                <TableCell className="text-right">
                  {assigningId === doc.id ? (
                    <div className="inline-block text-left" style={{ minWidth: 220 }}>
                      <PatientSearchDropdown
                        ajaxUrl={ajaxUrl}
                        csrfToken={csrfToken}
                        inputId={`unfiled-assign-${doc.id}`}
                        resultsId={`unfiled-assign-results-${doc.id}`}
                        placeholder="Search patient…"
                        disabled={savingId === doc.id}
                        onSelectPatient={(_pid, row) => {
                          if (row) void handleAssign(doc, row);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={savingId === doc.id}
                        onClick={() => setAssigningId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssigningId(doc.id)}
                    >
                      Assign…
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          {hasPager && (
            <div className="nc-reporthub-unfiled-pager flex justify-center gap-2 mt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={offset <= 0}
                onClick={() => void load(Math.max(0, offset - pageSize))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={offset + pageSize >= total}
                onClick={() => void load(offset + pageSize)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-[var(--oe-nc-text-muted)] text-xs mt-3 mb-0">
        Assigning files the document to that patient&rsquo;s Documents tab — it disappears from
        this list once assigned.
      </p>
    </div>
  );
}

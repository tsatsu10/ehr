import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Download, FileUp } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { Button } from '@components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { ConfirmModal } from '@components/ConfirmModal';
import { showDeskToast } from '@components/deskToast';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { parseCsv } from './parseCsv';
import { autoMatch } from './columnMatch';
import { findInFileDuplicates } from './fileDuplicates';
import { buildReportCsv, buildTemplateCsv, downloadCsv } from './csvBuilders';
import {
  IMPORT_FIELD_LABELS, type ChunkResponse, type ColumnMapping, type ImportField, type RowResult,
} from './types';

const CHUNK_SIZE = 200;
const PREVIEW_ROW_CAP = 200;

interface Props {
  ajaxUrl: string;
  csrfToken: string;
  /** Test seam: preloads the file content, skipping the FileReader. */
  initialCsvText?: string;
}

type Step = 'upload' | 'match' | 'checking' | 'preview' | 'importing' | 'done';

const STEP_INDEX: Record<Step, number> = {
  upload: 1,
  match: 2,
  checking: 2,
  preview: 3,
  importing: 3,
  done: 4,
};

const STEP_LABEL: Record<Step, string> = {
  upload: 'Upload',
  match: 'Match',
  checking: 'Checking file',
  preview: 'Review',
  importing: 'Importing',
  done: 'Done',
};

function pluralize(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

type StatTone = 'success' | 'warn' | 'danger';

function StatTile({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  return (
    <div className={`nc-import-stat-tile nc-import-stat-tile--${tone}`}>
      <p className="nc-import-stat-tile__label mb-1">{label}</p>
      <p className="nc-import-stat-tile__value mb-0">{value}</p>
    </div>
  );
}

export function PatientImportPanel({ ajaxUrl, csrfToken, initialCsvText }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  const loadCsvText = useCallback((text: string) => {
    const parsed = parseCsv(text);
    if (parsed.error) {
      setFileError(parsed.error);
      setFileWarning(null);
      return;
    }
    setFileError(null);
    setFileWarning(parsed.warning);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoMatch(parsed.headers));
    setStep('match');
  }, []);

  useEffect(() => {
    if (initialCsvText !== undefined) loadCsvText(initialCsvText);
    // Test seam only fires once on mount — re-running loadCsvText on every
    // render would re-parse and reset user column-mapping edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCsvText]);

  useEffect(() => {
    // Don't steal focus on first mount (the page/shell may have already
    // placed focus somewhere sensible) — only move it when the step actually
    // changes, so each new step's heading gets announced.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    file.text().then(loadCsvText).catch(() => {
      setFileError('Could not read that file. Make sure it is a plain CSV file.');
    });
  }, [loadCsvText]);

  const resetAll = useCallback(() => {
    setStep('upload');
    setFileError(null);
    setFileWarning(null);
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setResults([]);
    setProgress(0);
    setConfirmOpen(false);
    setFileName('');
  }, []);

  const backToUpload = useCallback(() => {
    setStep('upload');
    setFileError(null);
    setFileWarning(null);
    setHeaders([]);
    setRows([]);
    setMapping([]);
  }, []);

  const mappedRows = useMemo(() => rows.map((cells, i) => {
    const row: Record<string, string> = { row_number: String(i + 2) } as Record<string, string>;
    mapping.forEach((field, col) => { if (field) row[field] = (cells[col] ?? '').trim(); });
    return row;
  }), [rows, mapping]);

  const inFileDups = useMemo(() => findInFileDuplicates(mappedRows), [mappedRows]);
  const sendableRows = useMemo(() => mappedRows.filter((_, i) => !inFileDups.has(i)), [mappedRows, inFileDups]);
  const requiredMapped = mapping.includes('fname') && mapping.includes('lname');

  const runChunks = useCallback(async (dryRun: boolean) => {
    setStep(dryRun ? 'checking' : 'importing');
    setProgress(0);
    const collected: RowResult[] = [...inFileDups.entries()].map(([i, reason]) => ({
      row_number: i + 2, status: 'duplicate', reason, name: `${mappedRows[i]?.fname ?? ''} ${mappedRows[i]?.lname ?? ''}`.trim(), pid: null,
    }));
    try {
      for (let start = 0; start < sendableRows.length; start += CHUNK_SIZE) {
        const chunk = sendableRows.slice(start, start + CHUNK_SIZE)
          .map((r) => ({ ...r, row_number: Number(r.row_number) }));
        const data = await oeFetch<ChunkResponse>('admin.patient_import.chunk', {
          ajaxUrl, csrfToken,
          json: { dry_run: dryRun ? 1 : 0, rows: chunk },
        });
        collected.push(...data.results);
        setProgress(Math.min(1, (start + chunk.length) / Math.max(1, sendableRows.length)));
      }
      collected.sort((a, b) => a.row_number - b.row_number);
      setResults(collected);
      setStep(dryRun ? 'preview' : 'done');
      if (!dryRun) showDeskToast('Import finished', 'success');
    } catch (e) {
      // A chunk can fail partway through. Whatever chunks already succeeded —
      // plus any client-side in-file duplicates flagged before we ever sent a
      // request — are real outcomes and must replace whatever `results` held
      // before this call (the dry-run preview, on a real import). Otherwise
      // the Done screen would show the dry-run's prediction instead of what
      // was actually committed, right next to a "safe to re-run" message.
      collected.sort((a, b) => a.row_number - b.row_number);
      setResults(collected);
      setFileError(e instanceof Error ? e.message : 'Something went wrong — nothing else was imported.');
      setStep(dryRun ? 'match' : 'done');
    }
  }, [ajaxUrl, csrfToken, sendableRows, inFileDups, mappedRows]);

  const handleMappingChange = useCallback((col: number, value: string) => {
    setMapping((prev) => {
      const next = [...prev];
      next[col] = value === 'skip' ? null : (value as ImportField);
      return next;
    });
  }, []);

  const willImportCount = results.filter((r) => r.status === 'ok' || r.status === 'imported').length;
  const duplicateCount = results.filter((r) => r.status === 'duplicate').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const problemRows = useMemo(
    () => results.filter((r) => r.status === 'duplicate' || r.status === 'error'),
    [results]
  );
  const visibleProblemRows = problemRows.slice(0, PREVIEW_ROW_CAP);
  const hiddenProblemCount = problemRows.length - visibleProblemRows.length;

  const progressPercent = Math.round(progress * 100);
  const progressLabel = step === 'importing' ? 'Imported' : 'Checked';
  const progressCount = Math.round(progress * sendableRows.length);

  return (
    <div className="nc-import-panel">
      <p className="nc-import-panel__step-indicator text-sm font-medium text-[var(--oe-nc-text-muted)] mb-3">
        Step {STEP_INDEX[step]} of 4 — {STEP_LABEL[step]}
      </p>

      {step === 'upload' && (
        <section>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold mb-2 outline-none">
            Upload a patient list
          </h3>
          <div className="nc-import-upload-card">
            <FileUp className="h-6 w-6 mx-auto mb-2 text-[var(--oe-nc-primary)]" aria-hidden />
            <label htmlFor="nc-patient-import-file" className="block text-sm font-medium mb-2">
              Choose a CSV file
            </label>
            <input
              id="nc-patient-import-file"
              type="file"
              accept=".csv,text/csv"
              className="nc-import-file-input"
              onChange={handleFileChange}
            />
            <p className="text-sm text-[var(--oe-nc-text-muted)] mt-3 mb-0">
              Using Excel? Save your sheet as CSV first (File → Save As → CSV). Up to 5,000 patients per file.
            </p>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => downloadCsv('patient_import_template.csv', buildTemplateCsv())}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download a blank template
            </Button>
          </div>
          {fileError && (
            <div className={deskCalloutClass('error', 'mt-3')} role="alert">{fileError}</div>
          )}
        </section>
      )}

      {step === 'match' && (
        <section>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold mb-2 outline-none">
            Match columns
          </h3>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
            {fileName ? `File: ${fileName}. ` : ''}
            Tell us which file column holds each piece of patient information.
          </p>
          {fileWarning && (
            <div className={deskCalloutClass('warn', 'mb-3')}>{fileWarning}</div>
          )}
          <div className="overflow-x-auto">
            <table className="nc-import-table">
              <thead>
                <tr>
                  <th>File column</th>
                  <th>Sample values</th>
                  <th>Import as</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header, col) => {
                  const samples = rows.slice(0, 3).map((r) => r[col] ?? '').filter((v) => v !== '');
                  const selectValue = mapping[col] ?? 'skip';
                  return (
                    <tr key={`${header}-${col}`}>
                      <td className="font-medium">{header}</td>
                      <td className="text-[var(--oe-nc-text-muted)]">
                        {samples.length > 0 ? samples.join(', ') : '—'}
                      </td>
                      <td>
                        <Select
                          value={selectValue}
                          onValueChange={(value) => handleMappingChange(col, value)}
                        >
                          <SelectTrigger aria-label={`Import ${header} as`} className="h-10 w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Don&apos;t import</SelectItem>
                            {(Object.keys(IMPORT_FIELD_LABELS) as ImportField[]).map((field) => (
                              <SelectItem key={field} value={field}>
                                {IMPORT_FIELD_LABELS[field]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!requiredMapped && (
            <div className={deskCalloutClass('warn', 'mt-3')}>
              Match a column to First name and Last name to continue.
            </div>
          )}

          {fileError && (
            <div className={deskCalloutClass('error', 'mt-3')} role="alert">{fileError}</div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              type="button"
              size="lg"
              disabled={!requiredMapped}
              onClick={() => { void runChunks(true); }}
            >
              Check file
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={backToUpload}>
              Choose a different file
            </Button>
          </div>
        </section>
      )}

      {(step === 'checking' || step === 'importing') && (
        <section>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold mb-2 outline-none">
            {step === 'checking' ? 'Checking your file' : 'Importing patients'}
          </h3>
          <div
            className="nc-admin-progress"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="nc-admin-progress__bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mt-2" aria-live="polite">
            {progressLabel} {pluralize(progressCount, 'row')} of {pluralize(sendableRows.length, 'row')}…
          </p>
        </section>
      )}

      {step === 'preview' && (
        <section>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold mb-2 outline-none">
            Review before importing
          </h3>

          <div className="nc-import-stat-row">
            <StatTile label="Will import" value={willImportCount} tone="success" />
            <StatTile label="Skipped as duplicates" value={duplicateCount} tone="warn" />
            <StatTile label="Rows with problems" value={errorCount} tone="danger" />
          </div>

          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
            Dates are read day-first: 05/03/1990 means 5 March 1990.
          </p>

          {fileError && (
            <div className={deskCalloutClass('error', 'mb-3')} role="alert">{fileError}</div>
          )}

          {problemRows.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="nc-import-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProblemRows.map((r) => (
                    <tr key={r.row_number}>
                      <td>{r.row_number}</td>
                      <td>{r.name || '—'}</td>
                      <td>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hiddenProblemCount > 0 && (
                <p className="text-sm text-[var(--oe-nc-text-muted)] mt-2 mb-0">
                  …and {pluralize(hiddenProblemCount, 'more row')}, all listed in the downloadable report.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/*
              The visible label stays static ("Import patients") rather than
              embedding the live count in its own text node: the count above
              in the "Will import" tile and this label would otherwise both
              be text-only elements showing the same digits, which is
              ambiguous for text-based queries (incl. our own tests) and for
              screen readers reading the page top-to-bottom. The exact count
              is still surfaced via aria-label and, a click later, the
              ConfirmModal title ("Import N patients now?").
            */}
            <Button
              type="button"
              size="lg"
              disabled={willImportCount === 0}
              aria-label={`Import ${pluralize(willImportCount, 'patient')}`}
              onClick={() => setConfirmOpen(true)}
            >
              Import patients
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => downloadCsv('patient_import_check.csv', buildReportCsv(results))}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download full report
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={backToUpload}>
              Back
            </Button>
          </div>

          <ConfirmModal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={`Import ${willImportCount} patients now?`}
            confirmLabel="Import"
            confirmVariant="primary"
            onConfirm={() => {
              setConfirmOpen(false);
              void runChunks(false);
            }}
          >
            Duplicates and problem rows will be skipped. This cannot be undone from this screen.
          </ConfirmModal>
        </section>
      )}

      {step === 'done' && (
        <section>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold mb-2 outline-none">
            Import complete
          </h3>

          <div className="nc-import-stat-row">
            <StatTile label="Imported" value={willImportCount} tone="success" />
            <StatTile label="Skipped as duplicates" value={duplicateCount} tone="warn" />
            <StatTile label="Rows with problems" value={errorCount} tone="danger" />
          </div>

          {fileError && (
            <div className={deskCalloutClass('error', 'mb-3')} role="alert">
              {fileError} Rows up to the failure were already imported. It is safe to re-run this
              same file — already-imported rows will be skipped as duplicates.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => downloadCsv('patient_import_report.csv', buildReportCsv(results))}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download report
            </Button>
            <Button type="button" size="lg" onClick={resetAll}>
              Import another file
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

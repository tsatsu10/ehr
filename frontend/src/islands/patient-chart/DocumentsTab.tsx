import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { ConfirmModal } from '@components/ConfirmModal';
import { DataTable } from '@components/DataTable';
import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import { TableCell, TableHead, TableRow } from '@components/ui/table';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChartEmptyState, ChartLoadingState } from './chartUi';
import {
  deleteDocument,
  fetchDocumentCategories,
  listDocuments,
  recategorizeDocument,
  uploadDocument,
} from './documentsApi';
import { formatBytes, formatDocDate, isImageMime, isPreviewable } from './documentsUi';
import type {
  DocumentCategory,
  DocumentsListResponse,
  PatientDocument,
} from './patientChartTypes';

interface DocumentsTabProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  active: boolean;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function DocumentsTab({ ajaxUrl, csrfToken, pid, active }: DocumentsTabProps) {
  const ctx = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [offset, setOffset] = useState(0);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [uploadCategory, setUploadCategory] = useState<number>(0);

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [preview, setPreview] = useState<PatientDocument | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<PatientDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyList = useCallback((data: DocumentsListResponse) => {
    setDocuments(data.documents);
    setTotal(data.total);
    setPageSize(data.page_size);
    setOffset(data.offset);
  }, []);

  const loadList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await listDocuments(ctx, pid, nextOffset);
        applyList(data);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load documents.');
      } finally {
        setLoading(false);
      }
    },
    [applyList, ctx, pid],
  );

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchDocumentCategories(ctx);
      setCategories(data.categories ?? []);
      setUploadCategory((prev) => (prev > 0 ? prev : (data.categories?.[0]?.id ?? 0)));
    } catch {
      /* non-fatal — upload still works with the default category */
    }
  }, [ctx]);

  useEffect(() => {
    if (active && !loaded) {
      void loadList(0);
      void loadCategories();
    }
  }, [active, loaded, loadCategories, loadList]);

  const doUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError('File exceeds the 10 MB limit.');
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        await uploadDocument(ctx, pid, uploadCategory, file);
        await loadList(0);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [ctx, loadList, pid, uploadCategory],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void doUpload(file);
    },
    [doUpload],
  );

  const changeCategory = useCallback(
    async (nextCategoryId: number) => {
      if (!preview || nextCategoryId === preview.category_id) return;
      setSavingCategory(true);
      try {
        await recategorizeDocument(ctx, pid, preview.id, nextCategoryId);
        setPreview({
          ...preview,
          category_id: nextCategoryId,
          category_name: categories.find((c) => c.id === nextCategoryId)?.name ?? '',
        });
        await loadList(offset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not move document.');
      } finally {
        setSavingCategory(false);
      }
    },
    [categories, ctx, loadList, offset, pid, preview],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(ctx, pid, pendingDelete.id);
      if (preview?.id === pendingDelete.id) setPreview(null);
      setPendingDelete(null);
      const nextOffset =
        documents.length === 1 && offset >= pageSize ? offset - pageSize : offset;
      await loadList(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }, [ctx, documents.length, loadList, offset, pageSize, pendingDelete, pid, preview]);

  const hasPager = total > pageSize;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + documents.length, total);

  if (loading && !loaded) {
    return <ChartLoadingState label="Loading documents…" />;
  }

  return (
    <div className="nc-chart-docs">
      <div
        className={`nc-chart-docs__dropzone${dragging ? ' nc-chart-docs__dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload className="h-5 w-5" aria-hidden="true" />
        <div className="nc-chart-docs__dropzone-text">
          <p className="mb-0 font-medium text-[var(--oe-nc-text)]">
            Drag a file here, or choose one to upload
          </p>
          <p className="mb-0 text-xs text-[var(--oe-nc-text-muted)]">
            PDF or image (JPEG, PNG, GIF, WebP), up to 10 MB
          </p>
        </div>
        <div className="nc-chart-docs__dropzone-actions">
          {categories.length > 0 && (
            <NativeSelect
              aria-label="Upload category"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(Number(e.target.value))}
              className="max-w-[12rem]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            aria-label="Choose a file to upload"
            accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doUpload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Choose file'}
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className={deskCalloutClass('error')} role="alert">
          {uploadError}
        </div>
      )}
      {error && (
        <div className={deskCalloutClass('error')} role="alert">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <ChartEmptyState
          title="No documents yet"
          description="Uploaded scans, referrals, and results will appear here."
        />
      ) : (
        <>
          <div className="nc-chart-docs__toolbar">
            <span className="text-xs text-[var(--oe-nc-text-muted)]">
              Showing {pageStart}–{pageEnd} of {total}
            </span>
          </div>
          <DataTable
            hover
            bordered
            header={
              <TableRow>
                <TableHead scope="col">Document</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Uploaded by</TableHead>
                <TableHead scope="col" className="text-right">
                  Actions
                </TableHead>
              </TableRow>
            }
          >
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <button
                    type="button"
                    className="nc-chart-docs__name-btn"
                    onClick={() => setPreview(doc)}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>{doc.name || `Document #${doc.id}`}</span>
                  </button>
                </TableCell>
                <TableCell>{doc.category_name || '—'}</TableCell>
                <TableCell>{formatDocDate(doc.date)}</TableCell>
                <TableCell>{doc.uploader || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="nc-chart-docs__row-actions">
                    <a
                      className="nc-chart-docs__icon-link"
                      href={doc.view_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Download ${doc.name || 'document'}`}
                      title="Download"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      className="nc-chart-docs__icon-btn nc-chart-docs__icon-btn--danger"
                      aria-label={`Delete ${doc.name || 'document'}`}
                      title="Delete"
                      onClick={() => setPendingDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          {hasPager && (
            <div className="nc-chart-docs__pager">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={offset <= 0 || loading}
                onClick={() => void loadList(Math.max(0, offset - pageSize))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={offset + pageSize >= total || loading}
                onClick={() => void loadList(offset + pageSize)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <SlideOver
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name || 'Document'}
        width="lg"
      >
        {preview && (
          <div className="nc-chart-docs__preview">
            <dl className="nc-chart-docs__meta">
              <div>
                <dt>Uploaded</dt>
                <dd>{formatDocDate(preview.date) || '—'}</dd>
              </div>
              <div>
                <dt>By</dt>
                <dd>{preview.uploader || '—'}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(preview.size)}</dd>
              </div>
            </dl>

            <label className="nc-chart-docs__field">
              <span className="nc-chart-docs__field-label">Category</span>
              <NativeSelect
                value={preview.category_id}
                disabled={savingCategory || categories.length === 0}
                onChange={(e) => void changeCategory(Number(e.target.value))}
              >
                {categories.length === 0 && (
                  <option value={preview.category_id}>{preview.category_name || '—'}</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <div className="nc-chart-docs__viewer">
              {isImageMime(preview.mimetype) ? (
                <img src={preview.view_url} alt={preview.name} className="nc-chart-docs__image" />
              ) : isPreviewable(preview.mimetype) ? (
                <iframe
                  title={preview.name}
                  src={preview.view_url}
                  className="nc-chart-docs__iframe"
                />
              ) : (
                <div className="nc-chart-docs__no-preview">
                  <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]">
                    This file type can’t be previewed here.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <a href={preview.view_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        confirmLabel="Delete document"
        confirmVariant="danger"
        submitting={deleting}
        submittingLabel="Deleting…"
        onConfirm={() => void confirmDelete()}
      >
        <p className="mb-0">
          {pendingDelete?.name
            ? `“${pendingDelete.name}” will be removed from this patient’s chart.`
            : 'This document will be removed from the chart.'}{' '}
          Staff with legacy access can still recover it.
        </p>
      </ConfirmModal>
    </div>
  );
}

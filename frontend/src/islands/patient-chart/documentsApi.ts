import { oeFetch } from '@core/oeFetch';
import type {
  DocumentCategory,
  DocumentsListResponse,
  PatientDocument,
} from './patientChartTypes';

interface FetchContext {
  ajaxUrl: string;
  csrfToken: string;
}

export function listDocuments(
  ctx: FetchContext,
  pid: number,
  offset: number,
): Promise<DocumentsListResponse> {
  return oeFetch<DocumentsListResponse>('documents.list', {
    ...ctx,
    params: { pid, offset },
  });
}

export function fetchDocumentCategories(
  ctx: FetchContext,
): Promise<{ categories: DocumentCategory[] }> {
  return oeFetch<{ categories: DocumentCategory[] }>('documents.categories', { ...ctx });
}

export interface DocumentUploadResult {
  document_id: number;
  filename: string;
}

export function uploadDocument(
  ctx: FetchContext,
  pid: number,
  categoryId: number,
  file: File,
): Promise<DocumentUploadResult> {
  // Multipart: oeFetch passes a FormData body through untouched (browser sets
  // the boundary); CSRF rides in both the form field and the X-CSRF-Token header.
  const form = new FormData();
  form.append('pid', String(pid));
  form.append('category_id', String(categoryId));
  form.append('file', file);
  form.append('csrf_token_form', ctx.csrfToken);

  return oeFetch<DocumentUploadResult>('documents.upload', {
    ...ctx,
    method: 'POST',
    body: form,
  });
}

export function recategorizeDocument(
  ctx: FetchContext,
  pid: number,
  id: number,
  categoryId: number,
): Promise<PatientDocument | Record<string, never>> {
  return oeFetch('documents.recategorize', {
    ...ctx,
    json: { pid, id, category_id: categoryId },
  });
}

export function deleteDocument(
  ctx: FetchContext,
  pid: number,
  id: number,
): Promise<Record<string, never>> {
  return oeFetch('documents.delete', {
    ...ctx,
    json: { pid, id },
  });
}

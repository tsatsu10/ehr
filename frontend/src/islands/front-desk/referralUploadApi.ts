import { oeFetch } from '@core/oeFetch';

export interface ReferralUploadResult {
  document_id: number;
  filename: string;
  view_url?: string;
}

export async function uploadReferralDocument(
  ajaxUrl: string,
  csrfToken: string,
  pid: number,
  file: File,
  facilityId?: number,
): Promise<ReferralUploadResult> {
  const form = new FormData();
  form.append('pid', String(pid));
  form.append('file', file);
  form.append('csrf_token_form', csrfToken);
  if (facilityId != null && facilityId > 0) {
    form.append('facility_id', String(facilityId));
  }

  return oeFetch<ReferralUploadResult>('front_desk.upload_referral', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    body: form,
  });
}

import { useCallback, useEffect, useState } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import type { ReferralEditorData } from './chartDepthTypes';

interface ReferralEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  transactionId: number | null;
  patientLabel: string;
  onSaved: () => void;
}

const EMPTY_FIELDS: Record<string, string> = {
  refer_date: '',
  refer_to: '',
  refer_diag: '',
  refer_risk_level: '',
  body: '',
  reply_date: '',
  reply_init_diag: '',
  reply_final_diag: '',
  reply_findings: '',
  reply_services: '',
  reply_recommend: '',
};

/**
 * CP-1 — native referral editor (replaces the stock add_transaction.php form
 * when enable_native_referral_editor is on). Edits the LBTref working set plus
 * the reply/counter-referral section.
 */
export function ReferralEditorDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  transactionId,
  patientLabel,
  onSaved,
}: ReferralEditorDrawerProps) {
  const [fields, setFields] = useState<Record<string, string>>(EMPTY_FIELDS);
  const [fingerprint, setFingerprint] = useState('');
  const [riskLevels, setRiskLevels] = useState<{ value: string; label: string }[]>([]);
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = { ajaxUrl, csrfToken };

  useEffect(() => {
    if (!open || !transactionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await oeFetch<ReferralEditorData>('chart_depth.referral_editor_get', {
          ajaxUrl,
          csrfToken,
          params: { transaction_id: transactionId },
        });
        if (cancelled) return;
        setFields({ ...EMPTY_FIELDS, ...(data.fields ?? {}) });
        setFingerprint(data.fingerprint ?? '');
        setRiskLevels(data.risk_levels ?? []);
        // Open the reply section when a counter-referral was already captured.
        setShowReply(
          ['reply_date', 'reply_findings', 'reply_final_diag', 'reply_recommend'].some(
            (k) => (data.fields?.[k] ?? '') !== ''
          )
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the referral.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId]);

  const setField = useCallback((key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const referToInvalid = fields.refer_to.trim() === '';

  const save = useCallback(async () => {
    if (!transactionId || referToInvalid) return;
    setSaving(true);
    setError(null);
    try {
      await oeFetch('chart_depth.referral_update', {
        ...fetchOptions,
        method: 'POST',
        json: { transaction_id: transactionId, fields, expected_fingerprint: fingerprint },
      });
      showDeskToast('Referral saved', 'success');
      onSaved();
    } catch (err) {
      if (err instanceof OeFetchError && err.status === 409) {
        // Someone else changed this referral while it was open. Keep the
        // user's typing (never wipe the form), refresh the token so a second
        // save is a conscious overwrite, and say so plainly.
        try {
          const fresh = await oeFetch<ReferralEditorData>('chart_depth.referral_editor_get', {
            ...fetchOptions,
            params: { transaction_id: transactionId },
          });
          setFingerprint(fresh.fingerprint ?? '');
        } catch {
          /* keep the old token; the next save will 409 again, which is safe */
        }
        setError(
          'This referral was changed by someone else while you were editing. '
          + 'Your entries are kept — review them, then save again to overwrite.'
        );
        showDeskToast('Referral changed by someone else — review before saving', 'warning');
      } else {
        setError(err instanceof Error ? err.message : 'Could not save the referral.');
      }
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, fields, fingerprint, referToInvalid, onSaved]);

  const textField = (key: string, label: string, required = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`nc-refedit-${key}`}>{label}</Label>
      <Input
        id={`nc-refedit-${key}`}
        value={fields[key] ?? ''}
        onChange={(e) => setField(key, e.target.value)}
        aria-invalid={required && (fields[key] ?? '').trim() === '' ? true : undefined}
      />
      {required && (fields[key] ?? '').trim() === '' && (
        <p className="m-0 text-xs text-[var(--oe-nc-danger)]">Required</p>
      )}
    </div>
  );

  const dateField = (key: string, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`nc-refedit-${key}`}>{label}</Label>
      <Input
        id={`nc-refedit-${key}`}
        type="date"
        value={fields[key] ?? ''}
        onChange={(e) => setField(key, e.target.value)}
      />
    </div>
  );

  const areaField = (key: string, label: string, rows = 3) => (
    <div className="space-y-1.5">
      <Label htmlFor={`nc-refedit-${key}`}>{label}</Label>
      <Textarea
        id={`nc-refedit-${key}`}
        rows={rows}
        value={fields[key] ?? ''}
        onChange={(e) => setField(key, e.target.value)}
      />
    </div>
  );

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title="Edit referral"
      id="nc-referral-editor"
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={saving || loading || referToInvalid}
          >
            {saving ? 'Saving…' : 'Save referral'}
          </Button>
        </div>
      )}
    >
      {patientLabel && (
        <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">{patientLabel}</p>
      )}

      {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading referral…</p>
      ) : (
        <div className="space-y-3">
          {dateField('refer_date', 'Referral date')}
          {textField('refer_to', 'Refer to (facility — department)', true)}
          {textField('refer_diag', 'Referrer diagnosis')}
          <div className="space-y-1.5">
            <Label htmlFor="nc-refedit-risk">Risk level</Label>
            <NativeSelect
              id="nc-refedit-risk"
              value={fields.refer_risk_level ?? ''}
              onChange={(e) => setField('refer_risk_level', e.target.value)}
            >
              <option value="">—</option>
              {riskLevels.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </NativeSelect>
          </div>
          {areaField('body', 'Reason / clinical summary', 4)}

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showReply}
            onClick={() => setShowReply((v) => !v)}
          >
            {showReply ? 'Hide reply section' : 'Reply / counter-referral…'}
          </Button>

          {showReply && (
            <div
              className="space-y-3 p-3"
              // Longhand props: the bs:check ratchet's string scanner counts the
              // shorthand style key as the Bootstrap-colliding class name.
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'var(--oe-nc-border)',
                borderRadius: '0.5rem',
              }}
            >
              {dateField('reply_date', 'Reply date')}
              {textField('reply_init_diag', 'Presumed diagnosis')}
              {textField('reply_final_diag', 'Final diagnosis')}
              {areaField('reply_findings', 'Findings')}
              {areaField('reply_services', 'Services provided')}
              {areaField('reply_recommend', 'Recommendations and treatment')}
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}

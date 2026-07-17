import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { formatBillMoney } from './billOpsFormatters';
import type { PayerScheme } from './billOpsTypes';

interface SchemeClaimRow {
  id: number;
  visit_id: number;
  display_name: string;
  pubpid: string;
  insurance_company_id: number;
  scheme_name: string;
  membership_number: string;
  scheme_owed: number;
  patient_pay: number;
  status: string;
  rejection_note: string;
  created_at: string;
  age_days: number;
  age_bucket: '0_7' | '8_30' | '31_plus' | string;
}

interface SchemeClaimsData {
  enabled: boolean;
  status: string;
  schemes: PayerScheme[];
  rows: SchemeClaimRow[];
}

const RIGHT = { textAlign: 'right' as const };

const AGE_BUCKET_LABELS: Record<string, string> = {
  '0_7': '0–7 days',
  '8_30': '8–30 days',
  '31_plus': '31+ days',
};

function ageBadgeVariant(bucket: string): 'neutral' | 'warning' | 'danger' {
  if (bucket === '31_plus') return 'danger';
  if (bucket === '8_30') return 'warning';
  return 'neutral';
}

/** CBILL-3c/4d — the "scheme claims to submit" register in the billing back office, with
 *  age/payer filters and a rejected status (CBILL-4d). */
export function SchemeClaimsList({ ajaxUrl, csrfToken }: { ajaxUrl: string; csrfToken: string }) {
  const [status, setStatus] = useState('to_submit');
  const [schemeFilter, setSchemeFilter] = useState(0);
  const [ageBucket, setAgeBucket] = useState('');
  const [data, setData] = useState<SchemeClaimsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(0);
  const [rejectingId, setRejectingId] = useState(0);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<SchemeClaimsData>('bill_ops.scheme_claims', {
        ajaxUrl,
        csrfToken,
        json: {
          status,
          insurance_company_id: schemeFilter > 0 ? schemeFilter : undefined,
          age_bucket: ageBucket || undefined,
        },
      });
      setData(payload);
    } catch {
      setError('Could not load scheme claims');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, status, schemeFilter, ageBucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(async (claimId: number, next: string, rejectionNote = '') => {
    setBusy(claimId);
    setError(null);
    try {
      await oeFetch('bill_ops.scheme_claim_status', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { claim_id: claimId, status: next, rejection_note: rejectionNote },
      });
      setRejectingId(0);
      setRejectReason('');
      await load();
    } catch {
      setError('Could not update the claim');
    } finally {
      setBusy(0);
    }
  }, [ajaxUrl, csrfToken, load]);

  const confirmReject = (claimId: number) => {
    if (rejectReason.trim() === '') {
      setError('A reason is required to mark a claim rejected');
      return;
    }
    void changeStatus(claimId, 'rejected', rejectReason.trim());
  };

  // The Insurance tab itself is a separate, broader flag (enable_insurance) from the
  // scheme-split feature that actually lives on it (enable_insurance_scheme) — a clinic can
  // have the tab visible with the feature still off. Show why, not a blank tab.
  if (data && !data.enabled) {
    return (
      <div className={deskCalloutClass('info', 'mb-0')}>
        Insurance scheme-split is not turned on for this clinic yet. Turn on
        {' '}<strong>Insurance scheme-split at the cashier</strong> in Clinic Setup → Billing to use this tab.
      </div>
    );
  }

  return (
    <div className="nc-billops-scheme-claims mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-base font-semibold mb-0">Scheme claims to submit</h3>
        <NativeSelect
          className="h-8 w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Claim status filter"
        >
          <option value="to_submit">To submit</option>
          <option value="submitted">Submitted</option>
          <option value="rejected">Rejected</option>
          <option value="settled">Settled</option>
          <option value="void">Void</option>
        </NativeSelect>
        {data && (data.schemes?.length ?? 0) > 1 && (
          <NativeSelect
            className="h-8 w-auto"
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(Number(e.target.value))}
            aria-label="Payer filter"
          >
            <option value={0}>All payers</option>
            {(data.schemes ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          className="h-8 w-auto"
          value={ageBucket}
          onChange={(e) => setAgeBucket(e.target.value)}
          aria-label="Age filter"
        >
          <option value="">Any age</option>
          <option value="0_7">0–7 days</option>
          <option value="8_30">8–30 days</option>
          <option value="31_plus">31+ days</option>
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        {data && data.rows.length > 0 && (
          <Button asChild variant="outline" size="sm">
            <a
              href={`${ajaxUrl}${ajaxUrl.includes('?') ? '&' : '?'}action=bill_ops.scheme_claims_export&status=${status}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Export CSV
            </a>
          </Button>
        )}
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {data && data.rows.length === 0 && (
        <p className="text-[var(--oe-nc-text-muted)] text-sm">No claims in this state.</p>
      )}

      {data && data.rows.length > 0 && (
        <Table className={ncShadcnTableClass({ hover: true })}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Patient</TableHead>
              <TableHead scope="col">Scheme</TableHead>
              <TableHead scope="col">Membership</TableHead>
              <TableHead scope="col" style={RIGHT}>Scheme owes</TableHead>
              <TableHead scope="col">Age</TableHead>
              <TableHead scope="col" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.display_name}
                  <span className="text-[var(--oe-nc-text-muted)] text-sm block">{row.pubpid}</span>
                </TableCell>
                <TableCell>{row.scheme_name}</TableCell>
                <TableCell>{row.membership_number}</TableCell>
                <TableCell style={RIGHT}>{formatBillMoney(row.scheme_owed)}</TableCell>
                <TableCell>
                  <Badge variant={ageBadgeVariant(row.age_bucket)}>
                    {AGE_BUCKET_LABELS[row.age_bucket] ?? `${row.age_days}d`}
                  </Badge>
                </TableCell>
                <TableCell style={RIGHT}>
                  {row.status === 'rejected' && row.rejection_note && (
                    <div className="text-sm text-[var(--oe-nc-text-muted)] mb-1 text-left" title={row.rejection_note}>
                      {row.rejection_note}
                    </div>
                  )}
                  {rejectingId === row.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <Input
                        className="h-8 w-48"
                        placeholder="Reason the claim was rejected"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        aria-label="Rejection reason"
                      />
                      <Button variant="danger" size="sm" disabled={busy === row.id} onClick={() => confirmReject(row.id)}>
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setRejectingId(0); setRejectReason(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      {row.status === 'to_submit' && (
                        <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'submitted')}>
                          Mark submitted
                        </Button>
                      )}
                      {row.status === 'submitted' && (
                        <>
                          <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'settled')}>
                            Mark settled
                          </Button>
                          <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => { setRejectingId(row.id); setRejectReason(''); setError(null); }}>
                            Reject
                          </Button>
                        </>
                      )}
                      {row.status === 'rejected' && (
                        <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'to_submit')}>
                          Resubmit
                        </Button>
                      )}
                      {(row.status === 'to_submit' || row.status === 'submitted' || row.status === 'rejected') && (
                        <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'void')}>
                          Void
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

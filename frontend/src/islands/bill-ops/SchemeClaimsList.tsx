import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
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

interface SchemeClaimRow {
  id: number;
  visit_id: number;
  display_name: string;
  pubpid: string;
  scheme_name: string;
  membership_number: string;
  scheme_owed: number;
  patient_pay: number;
  status: string;
  created_at: string;
}

interface SchemeClaimsData {
  enabled: boolean;
  status: string;
  rows: SchemeClaimRow[];
}

const RIGHT = { textAlign: 'right' as const };

/** CBILL-3c — the "scheme claims to submit" register in the billing back office. */
export function SchemeClaimsList({ ajaxUrl, csrfToken }: { ajaxUrl: string; csrfToken: string }) {
  const [status, setStatus] = useState('to_submit');
  const [data, setData] = useState<SchemeClaimsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<SchemeClaimsData>('bill_ops.scheme_claims', {
        ajaxUrl,
        csrfToken,
        json: { status },
      });
      setData(payload);
    } catch {
      setError('Could not load scheme claims');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(async (claimId: number, next: string) => {
    setBusy(claimId);
    setError(null);
    try {
      await oeFetch('bill_ops.scheme_claim_status', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { claim_id: claimId, status: next },
      });
      await load();
    } catch {
      setError('Could not update the claim');
    } finally {
      setBusy(0);
    }
  }, [ajaxUrl, csrfToken, load]);

  // Hidden entirely when the scheme feature is off.
  if (data && !data.enabled) return null;

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
          <option value="settled">Settled</option>
          <option value="void">Void</option>
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
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
                <TableCell style={RIGHT}>
                  <div className="flex gap-2 justify-end">
                    {row.status === 'to_submit' && (
                      <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'submitted')}>
                        Mark submitted
                      </Button>
                    )}
                    {row.status === 'submitted' && (
                      <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'settled')}>
                        Mark settled
                      </Button>
                    )}
                    {(row.status === 'to_submit' || row.status === 'submitted') && (
                      <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void changeStatus(row.id, 'void')}>
                        Void
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { oeFetch } from '@core/oeFetch';
import { ReferralWizard } from './ReferralWizard';
import type { ReferralRow, ReferralsListData, ReferralSaveResult } from './chartDepthTypes';

interface ReferralsPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  encounterId?: number;
}

function ReferralRowView({
  item,
  busy,
  onPrint,
  onStatus,
}: {
  item: ReferralRow;
  busy: boolean;
  onPrint: (item: ReferralRow) => void;
  onStatus: (item: ReferralRow, status: string) => void;
}) {
  // Status transitions only apply to wizard-tracked rows (M11-F03 meta).
  const nextStatus =
    item.status_key === 'printed' ? 'given' : item.status_key === 'given' ? 'result_received' : null;
  const nextLabel = nextStatus === 'given' ? 'Mark given' : 'Result received';

  return (
    <TableRow>
      <TableCell>
        <strong>{item.label ?? 'Referral'}</strong>
        <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.author ?? '—'}</div>
      </TableCell>
      <TableCell>{item.status ?? '—'}</TableCell>
      <TableCell>{item.occurred_at ?? '—'}</TableCell>
      <TableCell className="text-right">
        {item.print_url && (
          <Button
            variant="outline"
            size="sm"
            className="mr-1"
            disabled={busy}
            onClick={() => onPrint(item)}
          >
            Print
          </Button>
        )}
        {nextStatus && (
          <Button
            variant="outline"
            size="sm"
            className="mr-1"
            disabled={busy}
            onClick={() => onStatus(item, nextStatus)}
          >
            {nextLabel}
          </Button>
        )}
        {item.edit_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={item.edit_url} target="_top">
              Edit
            </a>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function ReferralsPane({ ajaxUrl, csrfToken, pid, encounterId }: ReferralsPaneProps) {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [createUrl, setCreateUrl] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setOffset(0);
      try {
        const params: Record<string, string | number> = { pid, offset: 0 };
        if (encounterId && encounterId > 0) params.encounter_id = encounterId;

        const data = await oeFetch<ReferralsListData>('chart_depth.referrals_list', {
          ...fetchOptions,
          params,
        });
        if (cancelled) return;

        setRows(data.items ?? []);
        setCanCreate(!!data.can_create_referral);
        setCreateUrl(
          data.can_create_referral && data.create_referral_url ? data.create_referral_url : null
        );
        setHasMore(!!data.has_more);
        setOffset((data.offset ?? 0) + (data.items ?? []).length);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load referrals.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [encounterId, fetchOptions, pid, reloadKey]);

  const handlePrint = useCallback(
    async (item: ReferralRow) => {
      const transactionId = item.transaction_id ?? 0;
      if (transactionId <= 0) {
        if (item.print_url) window.open(item.print_url, '_blank', 'noopener,noreferrer');
        return;
      }
      setRowBusyId(transactionId);
      try {
        const result = await oeFetch<ReferralSaveResult>('chart_depth.referral_print', {
          method: 'POST',
          ...fetchOptions,
          json: { transaction_id: transactionId },
        });
        window.open(result.print_url ?? item.print_url ?? '', '_blank', 'noopener,noreferrer');
        setReloadKey((k) => k + 1);
      } catch {
        if (item.print_url) window.open(item.print_url, '_blank', 'noopener,noreferrer');
      } finally {
        setRowBusyId(null);
      }
    },
    [fetchOptions],
  );

  const handleStatus = useCallback(
    async (item: ReferralRow, status: string) => {
      const transactionId = item.transaction_id ?? 0;
      if (transactionId <= 0) return;
      setRowBusyId(transactionId);
      try {
        await oeFetch('chart_depth.referral_status', {
          method: 'POST',
          ...fetchOptions,
          json: { transaction_id: transactionId, status },
        });
        setReloadKey((k) => k + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update the referral status.');
      } finally {
        setRowBusyId(null);
      }
    },
    [fetchOptions],
  );

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params: Record<string, string | number> = { pid, offset };
      if (encounterId && encounterId > 0) params.encounter_id = encounterId;

      const data = await oeFetch<ReferralsListData>('chart_depth.referrals_list', {
        ...fetchOptions,
        params,
      });

      setRows((prev) => [...prev, ...(data.items ?? [])]);
      setHasMore(!!data.has_more);
      setOffset((data.offset ?? 0) + (data.items ?? []).length);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <em>Loading referrals…</em>;
  }

  if (error) {
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  return (
    <>
      {canCreate && (
        <div id="nc-referrals-actions" className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" id="nc-referral-new-btn" onClick={() => setWizardOpen(true)}>
            New referral
          </Button>
          {createUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={createUrl} target="_top">
                Advanced (stock form)
              </a>
            </Button>
          )}
        </div>
      )}

      <ReferralWizard
        open={wizardOpen}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        pid={pid}
        encounterId={encounterId}
        onClose={() => setWizardOpen(false)}
        onSaved={() => {
          setWizardOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />

      {!rows.length ? (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No referrals for this filter.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody id="nc-referrals-rows">
                {rows.map((row, idx) => (
                  <ReferralRowView
                    key={`${row.transaction_id ?? idx}-${row.occurred_at ?? ''}`}
                    item={row}
                    busy={rowBusyId === (row.transaction_id ?? -1)}
                    onPrint={(item) => {
                      void handlePrint(item);
                    }}
                    onStatus={(item, status) => {
                      void handleStatus(item, status);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={loadingMore}
              onClick={() => {
                void loadMore();
              }}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </>
  );
}

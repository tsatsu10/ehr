import { useEffect, useMemo, useState } from 'react';
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
import type { ReferralRow, ReferralsListData } from './chartDepthTypes';

interface ReferralsPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  encounterId?: number;
}

function ReferralRowView({ item }: { item: ReferralRow }) {
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
          <Button variant="outline" size="sm" className="mr-1" asChild>
            <a href={item.print_url} target="_top">
              Print
            </a>
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
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [encounterId, fetchOptions, pid]);

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
      {createUrl && (
        <div id="nc-referrals-actions" className="mb-3">
          <Button size="sm" asChild>
            <a href={createUrl} target="_top">
              New referral
            </a>
          </Button>
        </div>
      )}

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
                  <ReferralRowView key={`${row.label ?? idx}-${row.occurred_at ?? ''}`} item={row} />
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

import { useEffect, useMemo, useState } from 'react';
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
    <tr>
      <td>
        <strong>{item.label ?? 'Referral'}</strong>
        <div className="small text-muted">{item.author ?? '—'}</div>
      </td>
      <td>{item.status ?? '—'}</td>
      <td>{item.occurred_at ?? '—'}</td>
      <td className="text-right">
        {item.print_url && (
          <a className="btn btn-sm btn-outline-secondary mr-1" href={item.print_url} target="_top">
            Print
          </a>
        )}
        {item.edit_url && (
          <a className="btn btn-sm btn-outline-primary" href={item.edit_url} target="_top">
            Edit
          </a>
        )}
      </td>
    </tr>
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
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <>
      {createUrl && (
        <div id="nc-referrals-actions" className="mb-3">
          <a className="btn btn-sm btn-primary" href={createUrl} target="_top">
            New referral
          </a>
        </div>
      )}

      {!rows.length ? (
        <p className="text-muted mb-0">No referrals for this filter.</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody id="nc-referrals-rows">
                {rows.map((row, idx) => (
                  <ReferralRowView key={`${row.label ?? idx}-${row.occurred_at ?? ''}`} item={row} />
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-2"
              disabled={loadingMore}
              onClick={() => {
                void loadMore();
              }}
            >
              Load more
            </button>
          )}
        </>
      )}
    </>
  );
}

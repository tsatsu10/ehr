import { useEffect, useMemo, useState } from 'react';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { Users } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { AdminSection } from './adminUi';

interface DuplicatePair {
  pid_a: number;
  name_a: string;
  pubpid_a: string;
  pid_b: number;
  name_b: string;
  pubpid_b: string;
  dob: string;
  reason: string;
}

interface DuplicateReview {
  enabled: boolean;
  pairs: DuplicatePair[];
  capped: boolean;
  merge_base_url: string;
}

interface DuplicatesCardProps {
  ajaxUrl: string;
  csrfToken: string;
  /** From the health payload — when false the card never mounts a fetch (PRD §5.6). */
  enabled: boolean;
}

export function DuplicatesCard({ ajaxUrl, csrfToken, enabled }: DuplicatesCardProps) {
  const [review, setReview] = useState<DuplicateReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await oeFetch<DuplicateReview>('admin.duplicates.list', opts);
        if (!cancelled) setReview(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load duplicate review.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [opts, enabled]);

  // Flag OFF (no fetch) or still loading → no chrome, matching PRD §5.6.
  if (!enabled) return null;
  if (loading) return null;
  if (!review || !review.enabled) return null;

  const pairs = review.pairs ?? [];

  return (
    <AdminSection
      title="Possible duplicates"
      description="Patient records that look like the same person. Review each before merging — merging is permanent."
      icon={<Users className="h-4 w-4" aria-hidden />}
    >
      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">{error}</div>
      )}
      {pairs.length === 0 ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
          No likely-duplicate records found.
        </p>
      ) : (
        <>
          <p className="mb-1 text-sm">
            {pairs.length}{review.capped ? '+' : ''} possible duplicate pair{pairs.length === 1 ? '' : 's'} found.
          </p>
          <p className="mb-2 text-xs text-[var(--oe-nc-text-muted)]">
            “Review &amp; merge” opens the stock merge tool, which requires super-admin access.
          </p>
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Record A</TableHead>
                  <TableHead scope="col">Record B</TableHead>
                  <TableHead scope="col">Match</TableHead>
                  <TableHead scope="col" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.map((pair) => (
                  <TableRow key={`${pair.pid_a}-${pair.pid_b}`}>
                    <TableCell>
                      {pair.name_a}
                      {pair.pubpid_a ? <span className="text-[var(--oe-nc-text-muted)]"> ({pair.pubpid_a})</span> : null}
                    </TableCell>
                    <TableCell>
                      {pair.name_b}
                      {pair.pubpid_b ? <span className="text-[var(--oe-nc-text-muted)]"> ({pair.pubpid_b})</span> : null}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)]">{pair.reason}</TableCell>
                    <TableCell className="text-nowrap">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`${review.merge_base_url}?pid1=${pair.pid_a}&pid2=${pair.pid_b}`}
                          target="_top"
                        >
                          Review &amp; merge
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AdminSection>
  );
}

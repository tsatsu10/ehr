import { useMemo, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { BookOpen } from 'lucide-react';
import type { RunbookCard, RunbooksPayload } from './adminTypes';
import { AdminEmptyState, AdminSection } from './adminUi';

interface RunbooksBoardProps {
  runbooks: RunbooksPayload;
}

export function RunbooksBoard({ runbooks }: RunbooksBoardProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return runbooks.cards;
    }
    return runbooks.cards.filter((card) => card.search_text.includes(needle));
  }, [query, runbooks.cards]);

  return (
    <AdminSection
      id="nc-admin-runbooks"
      title="Day-2 runbooks"
      description="Operational tasks RB-01–RB-20 (M15-F10). Search by task, lens, or ID."
      icon={<BookOpen className="h-4 w-4" aria-hidden />}
    >
      <Input
        type="search"
        className="mb-3 h-9 max-w-xs"
        placeholder="Search runbooks…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search runbooks"
      />

      {filtered.length === 0 ? (
        <AdminEmptyState title="No runbooks match your search" />
      ) : (
        <div className="grid grid-cols-12 gap-3">
          {filtered.map((card) => (
            <RunbookCardItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </AdminSection>
  );
}

function RunbookCardItem({ card }: { card: RunbookCard }) {
  return (
    <div className="col-span-12 mb-0 md:col-span-6 lg:col-span-4">
      <div className="nc-admin-runbook-card flex h-full flex-col p-4">
        <div className="mb-2 flex items-start justify-between">
          <Badge variant="outline">{card.id}</Badge>
          <span className="text-sm text-[var(--oe-nc-text-muted)]">{card.when}</span>
        </div>
        <h6 className="text-sm font-semibold">{card.task}</h6>
        <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]">{card.lens}</p>
        <p className="mb-3 flex-grow text-sm">{card.summary}</p>
        {card.deep_link ? (
          <Button variant="outline" size="sm" className="self-start" asChild>
            <a href={card.deep_link} target="_top">
              Open
            </a>
          </Button>
        ) : (
          <span className="text-sm text-[var(--oe-nc-text-muted)]">See training log / documentation</span>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import type { RunbookCard, RunbooksPayload } from './adminTypes';

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
    <Card className="mb-3" id="nc-admin-runbooks">
      <CardContent>
        <div className="flex flex-wrap items-start justify-between mb-2">
          <div>
            <h5 className="text-base font-semibold mb-1">Day-2 runbooks</h5>
            <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">
              Operational tasks RB-01–RB-20 (M15-F10). Search by task, lens, or ID.
            </p>
          </div>
        </div>

        <Input
          type="search"
          className="h-8 mb-3"
          style={{ maxWidth: '20rem' }}
          placeholder="Search runbooks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search runbooks"
        />

        <div className="grid grid-cols-12 gap-3">
          {filtered.map((card) => (
            <RunbookCardItem key={card.id} card={card} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-12 text-[var(--oe-nc-text-muted)] text-sm">No runbooks match your search.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RunbookCardItem({ card }: { card: RunbookCard }) {
  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4 mb-3">
      <Card className="h-full rounded-lg">
        <CardContent className="p-4 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <Badge variant="outline">{card.id}</Badge>
            <span className="text-sm text-[var(--oe-nc-text-muted)]">{card.when}</span>
          </div>
          <h6 className="text-sm font-semibold">{card.task}</h6>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">{card.lens}</p>
          <p className="text-sm flex-grow">{card.summary}</p>
          {card.deep_link ? (
            <Button variant="outline" size="sm" className="self-start" asChild>
              <a href={card.deep_link} target="_top">
                Open
              </a>
            </Button>
          ) : (
            <span className="text-sm text-[var(--oe-nc-text-muted)]">See training log / documentation</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { ReportHubRunbookCard } from './reportHubTypes';

interface Props {
  cards: ReportHubRunbookCard[];
}

export function ReportHubRunbooksPanel({ cards }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return cards;
    }
    return cards.filter((card) => card.search_text.includes(needle));
  }, [cards, query]);

  return (
    <Card className="nc-reporthub-runbooks mt-4" id="nc-report-hub-runbooks">
      <CardHeader>
        <CardTitle>Day-2 reporting runbooks</CardTitle>
        <CardDescription>Operational tasks RR-01–RR-12 (M16). Search by task, screen, or ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          type="search"
          className="h-8 mb-3"
          style={{ maxWidth: '20rem' }}
          placeholder="Search runbooks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search reporting runbooks"
        />
        <div className="grid grid-cols-12 gap-3">
          {filtered.map((card) => (
            <div className="col-span-12 md:col-span-6 lg:col-span-4 mb-3" key={card.id}>
              <Card className="h-full border">
                <CardContent className="flex flex-col h-full pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="neutral">{card.id}</Badge>
                    <span className="text-[var(--oe-nc-text-muted)] text-sm">{card.cadence}</span>
                  </div>
                  <h6 className="mb-1">{card.title}</h6>
                  <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">{card.screen}</p>
                  <p className="text-sm grow mb-3">{card.detail}</p>
                  {card.url ? (
                    <Button variant="outline" size="sm" className="align-self-start" asChild>
                      <a href={card.url}>Open</a>
                    </Button>
                  ) : (
                    <span className="text-[var(--oe-nc-text-muted)] text-sm">Manual / offline</span>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-12 text-[var(--oe-nc-text-muted)] text-sm">No runbooks match your search.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

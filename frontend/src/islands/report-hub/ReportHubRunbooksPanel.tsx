import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
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
    <Card className="oe-nc-reporthub-runbooks mt-4" id="nc-report-hub-runbooks">
      <CardHeader>
        <CardTitle>Day-2 reporting runbooks</CardTitle>
        <CardDescription>Operational tasks RR-01–RR-12 (M16). Search by task, screen, or ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          type="search"
          className="form-control form-control-sm mb-3"
          style={{ maxWidth: '20rem' }}
          placeholder="Search runbooks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search reporting runbooks"
        />
        <div className="row">
          {filtered.map((card) => (
            <div className="col-md-6 col-lg-4 mb-3" key={card.id}>
              <Card className="h-100 border">
                <CardContent className="d-flex flex-column h-100 pt-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge badge-light">{card.id}</span>
                    <span className="text-muted small">{card.cadence}</span>
                  </div>
                  <h6 className="mb-1">{card.title}</h6>
                  <p className="text-muted small mb-2">{card.screen}</p>
                  <p className="small grow mb-3">{card.detail}</p>
                  {card.url ? (
                    <a className="btn btn-sm btn-outline-primary align-self-start" href={card.url}>
                      Open
                    </a>
                  ) : (
                    <span className="text-muted small">Manual / offline</span>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-12 text-muted small">No runbooks match your search.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

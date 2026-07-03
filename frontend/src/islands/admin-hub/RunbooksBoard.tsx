import { useMemo, useState } from 'react';
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
    <div className="card mb-3" id="nc-admin-runbooks">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between mb-2">
          <div>
            <h5 className="card-title mb-1">Day-2 runbooks</h5>
            <p className="text-muted small mb-0">
              Operational tasks RB-01–RB-20 (M15-F10). Search by task, lens, or ID.
            </p>
          </div>
        </div>

        <input
          type="search"
          className="form-control form-control-sm mb-3"
          style={{ maxWidth: '20rem' }}
          placeholder="Search runbooks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search runbooks"
        />

        <div className="row">
          {filtered.map((card) => (
            <RunbookCardItem key={card.id} card={card} />
          ))}
          {filtered.length === 0 && (
            <div className="col-12 text-muted small">No runbooks match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunbookCardItem({ card }: { card: RunbookCard }) {
  return (
    <div className="col-md-6 col-lg-4 mb-3">
      <div className="card h-100 border">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="badge badge-light">{card.id}</span>
            <span className="small text-muted">{card.when}</span>
          </div>
          <h6 className="card-title">{card.task}</h6>
          <p className="small text-muted mb-2">{card.lens}</p>
          <p className="small flex-grow-1">{card.summary}</p>
          {card.deep_link ? (
            <a className="btn btn-outline-primary btn-sm align-self-start" href={card.deep_link} target="_top">
              Open
            </a>
          ) : (
            <span className="small text-muted">See training log / documentation</span>
          )}
        </div>
      </div>
    </div>
  );
}

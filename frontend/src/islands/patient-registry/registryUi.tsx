import type { ReactNode } from 'react';
import { Button } from '@components/ui/button';
import { SlidersHorizontal, Table2 } from 'lucide-react';

export function RegistryLayout({
  variables,
  output,
}: {
  variables: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="nc-registry-layout">
      <section className="nc-registry-layout__vars" aria-label="Search criteria">
        {variables}
      </section>
      <section className="nc-registry-layout__output" aria-label="Search results">
        {output}
      </section>
    </div>
  );
}

export function RegistryVarsPanel({
  children,
  presetControl,
  onApply,
  onClear,
}: {
  children: ReactNode;
  presetControl: ReactNode;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div className="nc-registry-vars-panel">
      <header className="nc-registry-vars-panel__header">
        <div className="nc-registry-vars-panel__heading">
          <div className="nc-registry-vars-panel__icon" aria-hidden="true">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="nc-registry-vars-panel__title">Search criteria</h2>
            <p className="nc-registry-vars-panel__sub">
              Set your variables above, then Apply — matching patients appear in the results table below.
            </p>
          </div>
        </div>
        <div className="nc-registry-vars-panel__toolbar">
          {presetControl}
          <Button type="button" size="sm" onClick={onApply}>
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </header>
      <div className="nc-registry-vars-panel__body">{children}</div>
    </div>
  );
}

export function RegistryOutputPanel({
  children,
  summaryText,
  status,
}: {
  children: ReactNode;
  summaryText: string;
  status: 'idle' | 'loading' | 'success' | 'error';
}) {
  return (
    <div className="nc-registry-output-panel">
      <header className="nc-registry-output-panel__header">
        <div className="nc-registry-output-panel__heading">
          <div className="nc-registry-output-panel__icon" aria-hidden="true">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="nc-registry-output-panel__title">Results</h2>
            <p
              className="nc-registry-output-panel__summary"
              id="nc-registry-summary"
              aria-live={status === 'loading' ? 'polite' : 'off'}
            >
              {summaryText}
            </p>
          </div>
        </div>
      </header>
      <div className="nc-registry-output-panel__body">{children}</div>
    </div>
  );
}

import { useState } from 'react';
import type { CashierPaidTodayRow } from '@core/types';
import { Button } from '@components/ui/button';

export function CashierPaidTodayList({ paidToday }: { paidToday: CashierPaidTodayRow[] }) {
  const [paidOpen, setPaidOpen] = useState(false);

  return (
    <div className="nc-cashier-paid-today">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="nc-cashier-paid-today__toggle"
        id="nc-cashier-done-toggle"
        onClick={() => setPaidOpen((v) => !v)}
      >
        Paid today ({paidToday.length})
      </Button>
      {paidOpen && (
        <div id="nc-cashier-paid-list" className="nc-cashier-paid-today__list">
          {paidToday.length === 0 ? (
            <div className="nc-cashier-paid-today__empty">None yet today</div>
          ) : (
            paidToday.map((row) => (
              <div key={row.id} className="nc-cashier-paid-today__row">
                <span>
                  #{row.queue_number} {row.display_name}
                </span>
                {row.charge_correction_url && (
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <a href={row.charge_correction_url} target="_top">
                      {row.charge_correction_label || 'Add correction'}
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

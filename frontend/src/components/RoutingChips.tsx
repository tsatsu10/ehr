/**
 * RoutingChips — lab/Rx status badges shared across doctor desk rendering paths.
 *
 * Mirrors renderRoutingChips() in doctor.js and ui-components.js.
 */

import type { RoutingChips as RoutingChipsData } from '@core/types';

interface RoutingChipsProps {
  chips?: RoutingChipsData | null;
  className?: string;
}

export function RoutingChips({ chips, className = '' }: RoutingChipsProps) {
  if (!chips) return null;

  return (
    <span className={className}>
      {chips.results_ready && (
        <span className="badge badge-success ml-1">Results ready</span>
      )}
      {!chips.results_ready && chips.lab_order_incomplete && (
        <span className="badge badge-danger ml-1">Lab order incomplete</span>
      )}
      {!chips.results_ready && !chips.lab_order_incomplete && chips.lab_ordered && (
        <span className="badge badge-warning ml-1">Lab ordered</span>
      )}
      {chips.rx_pending && (
        <span className="badge badge-info ml-1">Rx pending</span>
      )}
    </span>
  );
}

/**
 * RoutingChips — lab/Rx status badges shared across doctor desk rendering paths.
 *
 * Mirrors renderRoutingChips() in doctor.js and ui-components.js.
 */

import type { RoutingChips as RoutingChipsData } from '@core/types';
import { Badge } from '@components/ui/badge';
import { BannerClinicalLink } from './BannerClinicalLink';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';

interface RoutingChipsProps {
  chips?: RoutingChipsData | null;
  className?: string;
  mrdDeepLinks?: boolean;
  pid?: number;
  chartOpenUrl?: string;
}

export function RoutingChips({
  chips,
  className = '',
  mrdDeepLinks = false,
  pid = 0,
  chartOpenUrl,
}: RoutingChipsProps) {
  if (!chips) return null;

  const labsHref = mrdDeepLinks && pid > 0
    ? buildMrdClinicalDeepLink(pid, MRD_CLINICAL_ANCHORS.labs, chartOpenUrl)
    : undefined;
  const medsHref = mrdDeepLinks && pid > 0
    ? buildMrdClinicalDeepLink(pid, MRD_CLINICAL_ANCHORS.meds, chartOpenUrl)
    : undefined;

  return (
    <span className={className}>
      {chips.results_ready && (
        <BannerClinicalLink enabled={mrdDeepLinks} href={labsHref}>
          <Badge variant="success" className="ml-1">
            Results ready
          </Badge>
        </BannerClinicalLink>
      )}
      {!chips.results_ready && chips.lab_order_incomplete && (
        <BannerClinicalLink enabled={mrdDeepLinks} href={labsHref}>
          <Badge variant="danger" className="ml-1">
            Lab order incomplete
          </Badge>
        </BannerClinicalLink>
      )}
      {!chips.results_ready && !chips.lab_order_incomplete && chips.lab_ordered && (
        <BannerClinicalLink enabled={mrdDeepLinks} href={labsHref}>
          <Badge variant="warning" className="ml-1">
            Lab ordered
          </Badge>
        </BannerClinicalLink>
      )}
      {chips.rx_pending && (
        <BannerClinicalLink enabled={mrdDeepLinks} href={medsHref}>
          <Badge variant="info" className="ml-1">
            Rx pending
          </Badge>
        </BannerClinicalLink>
      )}
    </span>
  );
}

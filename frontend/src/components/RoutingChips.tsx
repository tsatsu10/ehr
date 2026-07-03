/**
 * RoutingChips — lab/Rx status badges shared across doctor desk rendering paths.
 *
 * Mirrors renderRoutingChips() in doctor.js and ui-components.js.
 */

import type { PatientPreview, RoutingChips as RoutingChipsData } from '@core/types';
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
        <BannerClinicalLink
          enabled={mrdDeepLinks}
          href={labsHref}
          className="badge badge-success ml-1"
        >
          Results ready
        </BannerClinicalLink>
      )}
      {!chips.results_ready && chips.lab_order_incomplete && (
        <BannerClinicalLink
          enabled={mrdDeepLinks}
          href={labsHref}
          className="badge badge-danger ml-1"
        >
          Lab order incomplete
        </BannerClinicalLink>
      )}
      {!chips.results_ready && !chips.lab_order_incomplete && chips.lab_ordered && (
        <BannerClinicalLink
          enabled={mrdDeepLinks}
          href={labsHref}
          className="badge badge-warning ml-1"
        >
          Lab ordered
        </BannerClinicalLink>
      )}
      {chips.rx_pending && (
        <BannerClinicalLink
          enabled={mrdDeepLinks}
          href={medsHref}
          className="badge badge-info ml-1"
        >
          Rx pending
        </BannerClinicalLink>
      )}
    </span>
  );
}

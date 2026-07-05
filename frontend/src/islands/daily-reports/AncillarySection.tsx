import { useMemo } from 'react';
import {
  FlaskConical,
  Pill,
  Stethoscope,
  FileWarning,
  Link2,
  Ban,
} from 'lucide-react';
import { StatCard } from '@components/StatCard';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { SectionBlock, SectionHeading, StatGrid } from './ReportsSections';
import type { AncillaryReportData } from './reportsTypes';

const STAT_ICON_SIZE = 18;

const PROFILE_LABELS: Record<string, string> = {
  full_opd: 'Full OPD',
  lab_direct: 'Lab-direct',
  pharmacy_walkin: 'Pharmacy walk-in',
};

const OUTCOME_LABELS: Record<string, string> = {
  otc_dispensed: 'OTC dispensed',
  external_rx_dispensed: 'External Rx dispensed',
  rx_required_refer_to_opd: 'Rx — refer to OPD',
  rx_required_no_doctor_available: 'Rx — no doctor available',
  rx_required_patient_declined: 'Rx — patient declined',
  unset: 'Outcome not recorded',
  other: 'Other outcome',
};

interface AncillarySectionProps {
  data: AncillaryReportData;
  ajaxUrl: string;
  facilityId?: number | string;
  startDate: string;
  endDate: string;
  onEndDateChange: (date: string) => void;
}

export function AncillarySection({
  data,
  ajaxUrl,
  facilityId,
  startDate,
  endDate,
  onEndDateChange,
}: AncillarySectionProps) {
  const exportUrl = useMemo(() => {
    const url = new URL(ajaxUrl, window.location.origin);
    url.searchParams.set('action', 'reports.ancillary_export');
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    const id = Number(facilityId ?? 0);
    if (id > 0) {
      url.searchParams.set('facility_id', String(id));
    }
    return url.toString();
  }, [ajaxUrl, endDate, facilityId, startDate]);

  if (!data.enabled) {
    return (
      <p className="text-[var(--oe-nc-text-muted)] mb-0">Ancillary walk-in services are off for this clinic.</p>
    );
  }

  const profiles = data.by_service_profile ?? {};
  const outcomes = data.pharmacy_outcomes ?? {};

  return (
    <>
      <SectionBlock>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <Label className="normal-case font-normal mb-1" htmlFor="nc-ancillary-end-date">
              End date
            </Label>
            <Input
              id="nc-ancillary-end-date"
              type="date"
              className="h-8"
              value={endDate}
              min={startDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </div>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
            Range: {data.start_date} – {data.end_date}
            {data.refer_window_hours != null && (
              <> · Pharmacy→OPD link window: {data.refer_window_hours}h</>
            )}
          </p>
          <Button variant="outline" size="sm" className="ms-auto" asChild>
            <a href={exportUrl}>
              Export CSV
            </a>
          </Button>
        </div>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Visits by service profile</SectionHeading>
        <StatGrid>
          <StatCard
            label={PROFILE_LABELS.full_opd}
            value={profiles.full_opd ?? 0}
            icon={<Stethoscope size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label={PROFILE_LABELS.lab_direct}
            value={profiles.lab_direct ?? 0}
            icon={<FlaskConical size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label={PROFILE_LABELS.pharmacy_walkin}
            value={profiles.pharmacy_walkin ?? 0}
            icon={<Pill size={STAT_ICON_SIZE} />}
          />
        </StatGrid>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Pharmacy walk-in outcomes</SectionHeading>
        <StatGrid>
          {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
            <StatCard
              key={key}
              label={label}
              value={outcomes[key] ?? 0}
              icon={<Pill size={STAT_ICON_SIZE} />}
            />
          ))}
        </StatGrid>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Quality &amp; routing signals</SectionHeading>
        <StatGrid>
          <StatCard
            label="Lab-direct without referral"
            value={data.lab_direct_without_referral ?? 0}
            icon={<FileWarning size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="Pharmacy → OPD same-day chains"
            value={data.pharmacy_to_opd_chains ?? 0}
            icon={<Link2 size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="Wrong visit type cancels"
            value={data.wrong_visit_type_cancels ?? 0}
            icon={<Ban size={STAT_ICON_SIZE} />}
          />
        </StatGrid>
      </SectionBlock>
    </>
  );
}

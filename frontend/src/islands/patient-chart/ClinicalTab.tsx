import { useEffect, useRef } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type {
  ClinicalBackgroundSection,
  ClinicalData,
  ClinicalLabsStrip,
  ClinicalListSection,
  ClinicalMedsStrip,
  ClinicalReferralsStrip,
  ClinicalThisVisitSection,
  ClinicalVitalsSection,
} from './patientChartTypes';

interface ClinicalTabProps {
  data: ClinicalData | null;
  referralsStrip: ClinicalReferralsStrip | null;
  labsStrip: ClinicalLabsStrip | null;
  medsStrip: ClinicalMedsStrip | null;
  loading: boolean;
  error: string | null;
  clinicalAnchor?: string;
  onScrollToAnchor: (anchor: string) => void;
}

function ClinicalListSectionBlock({
  title,
  section,
  emptyLabel,
}: {
  title: string;
  section: ClinicalListSection;
  emptyLabel: string;
}) {
  const items = section.items ?? [];

  let body: React.ReactNode;
  if (section.undocumented) {
    body = <p className="text-[var(--color-oe-warning,#ea580c)] text-sm mb-2">Allergies not documented.</p>;
  } else if (section.none_known) {
    body = <p className="text-[var(--oe-nc-text-muted)] mb-0">No known drug allergies.</p>;
  } else if (items.length) {
    body = (
      <ul className="list-none m-0 p-0 mb-0">
        {items.map((item, idx) => (
          <li key={`${item.title ?? idx}`} className="mb-2">
            <strong>{item.title}</strong>
            {item.detail && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.detail}</div>}
          </li>
        ))}
      </ul>
    );
  } else {
    body = <p className="text-[var(--oe-nc-text-muted)] mb-0">{emptyLabel}</p>;
  }

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? undefined}>
      <div className="flex justify-between items-start mb-2">
        <h5 className="mb-0">{title}</h5>
        {section.editor_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={section.editor_url} target="_top">
              Edit
            </a>
          </Button>
        )}
      </div>
      {body}
    </section>
  );
}

function ClinicalBackground({ section }: { section: ClinicalBackgroundSection }) {
  const lines = section.lines ?? [];

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-background'}>
      <div className="flex justify-between items-start mb-2">
        <h5 className="mb-0">Background</h5>
        {section.editor_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={section.editor_url} target="_top">
              Edit history
            </a>
          </Button>
        )}
      </div>
      {lines.length ? (
        <dl className="mb-0">
          {lines.map((line) => (
            <div key={line.label ?? line.value}>
              <dt className="text-sm text-[var(--oe-nc-text-muted)]">{line.label}</dt>
              <dd className="mb-2">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No background documented.</p>
      )}
    </section>
  );
}

function ClinicalVitals({ section }: { section: ClinicalVitalsSection }) {
  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-vitals'}>
      <h5 className="mb-2">Vitals today</h5>
      {section.summary ? (
        <>
          <div>
            {section.summary}
            {section.pain_score !== null &&
              section.pain_score !== undefined &&
              section.pain_score !== '' &&
              ` · Pain ${section.pain_score}`}
          </div>
          {section.abnormal && (section.warnings ?? []).length > 0 && (
            <div className="mt-2">
              {(section.warnings ?? []).map((w) => (
                <Badge key={w} variant="danger" className="mr-1">
                  {w}
                </Badge>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No vitals recorded today.</p>
      )}
    </section>
  );
}

function ClinicalThisVisit({ section }: { section: ClinicalThisVisitSection }) {
  if (section.hidden) return null;

  const forms = section.forms ?? [];
  const note = section.encounter_note;

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-encounter-forms'}>
      <div className="flex justify-between items-start mb-2 flex-wrap">
        <h5 className="mb-0">This visit</h5>
        {section.open_encounter_url && (
          <Button size="sm" asChild>
            <a href={section.open_encounter_url} target="_top">
              Open encounter
            </a>
          </Button>
        )}
      </div>
      {note?.native_enabled ? (
        <div className="border rounded p-3 mb-3 bg-[var(--oe-nc-bg-tint)]">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <strong>Consultation note</strong>
                <Badge variant={note.signed ? 'success' : note.validate_ready ? 'warning' : 'neutral'}>
                  {note.signed ? 'Signed' : note.validate_ready ? 'Ready to sign' : 'Draft'}
                </Badge>
                {note.variant_label ? (
                  <Badge variant="neutral">{note.variant_label}</Badge>
                ) : null}
              </div>
              {note.cc_preview ? (
                <p className="text-sm text-[var(--oe-nc-text-muted)] mb-1">{note.cc_preview}</p>
              ) : null}
              {(note.problem_count ?? 0) > 0 ? (
                <p className="text-sm mb-0">
                  {note.problem_count} problem{(note.problem_count ?? 0) === 1 ? '' : 's'}
                  {(note.incomplete_problem_count ?? 0) > 0 && !note.signed
                    ? ` · ${note.incomplete_problem_count} incomplete`
                    : ''}
                </p>
              ) : null}
            </div>
            {note.open_url ? (
              <Button size="sm" asChild>
                <a href={note.open_url} target="_top">
                  {note.signed ? 'View note' : 'Open consult note'}
                </a>
              </Button>
            ) : null}
          </div>
          {note.problem_labels && note.problem_labels.length > 0 ? (
            <ul className="text-sm text-[var(--oe-nc-text-muted)] mb-0 pl-4 list-disc">
              {note.problem_labels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {forms.length ? (
        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Author</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form, idx) => (
                <TableRow key={`${form.title ?? idx}-${form.date ?? ''}`}>
                  <TableCell>
                    {form.form_url ? (
                      <a href={form.form_url} target="_top">
                        {form.title ?? 'Form'}
                      </a>
                    ) : (
                      form.title ?? 'Form'
                    )}
                  </TableCell>
                  <TableCell className="text-[var(--oe-nc-text-muted)] text-sm">{form.date ?? '—'}</TableCell>
                  <TableCell className="text-[var(--oe-nc-text-muted)] text-sm">{form.author ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={form.signed ? 'success' : 'neutral'}>
                      {form.signed ? 'Signed' : 'Unsigned'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : section.empty ? (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No encounter forms recorded yet.</p>
      ) : null}
    </section>
  );
}

function ReferralsStrip({
  strip,
}: {
  strip: ClinicalReferralsStrip;
}) {
  if (strip.hidden) return null;

  const latest = strip.items?.[0];
  const summary = latest
    ? `${latest.label ?? 'Referral'} · ${latest.status ?? '—'}${latest.occurred_at ? ` · ${latest.occurred_at}` : ''}`
    : 'Referrals on file for this visit.';

  return (
    <section className="border rounded p-3 mb-3 bg-[var(--oe-nc-bg-tint)]" id="nc-clinical-referrals-strip">
      <div className="flex flex-wrap justify-between items-start">
        <div className="flex-grow mb-2 md:mb-0">
          <h5 className="mb-1">Referrals</h5>
          <div className="text-sm">→ {summary}</div>
        </div>
        {strip.open_referrals_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={strip.open_referrals_url} target="_top">
              Open referrals
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}

function LabsStrip({
  strip,
  onScrollToAnchor,
}: {
  strip: ClinicalLabsStrip;
  onScrollToAnchor: (anchor: string) => void;
}) {
  if (strip.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3 bg-[var(--oe-nc-bg-tint)]${strip.pending_warning ? ' border-warning' : ''}`}
      id="nc-clinical-labs-strip"
    >
      <div className="flex flex-wrap justify-between items-start">
        <div className="flex-grow mb-2 md:mb-0">
          <h5 className="mb-1">Labs</h5>
          <div className="text-sm">{strip.labs_strip_label ?? 'Labs on file for this visit.'}</div>
        </div>
        <div className="flex flex-wrap">
          {strip.lab_ops_url && (
            <Button variant="outline" size="sm" className="mr-2 mb-1" asChild>
              <a href={strip.lab_ops_url} target="_top">
                Open in Lab Ops
              </a>
            </Button>
          )}
          {strip.place_order_url && (
            <Button variant="outline" size="sm" className="mr-2 mb-1" asChild>
              <a href={strip.place_order_url} target="_top">
                Place lab order
              </a>
            </Button>
          )}
          {strip.pending_orders_url && (
            <Button variant="outline" size="sm" className="mr-2 mb-1" asChild>
              <a href={strip.pending_orders_url} target="_top">
                Pending orders
              </a>
            </Button>
          )}
          {strip.view_trends_anchor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-1"
              onClick={() => onScrollToAnchor(strip.view_trends_anchor ?? '')}
            >
              View trends
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function MedsStrip({
  strip,
  onScrollToAnchor,
}: {
  strip: ClinicalMedsStrip;
  onScrollToAnchor: (anchor: string) => void;
}) {
  if (strip.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3 bg-[var(--oe-nc-bg-tint)]${strip.undispensed_warning ? ' border-warning' : ''}`}
      id="nc-clinical-meds-strip"
    >
      <div className="flex flex-wrap justify-between items-start">
        <div className="flex-grow mb-2 md:mb-0">
          <h5 className="mb-1">Medications</h5>
          <div className="text-sm">{strip.meds_strip_label ?? 'Medications on file for this visit.'}</div>
        </div>
        <div className="flex flex-wrap">
          {strip.pharm_ops_url && (
            <Button variant="outline" size="sm" className="mr-2 mb-1" asChild>
              <a href={strip.pharm_ops_url} target="_top">
                Open in Pharm Ops
              </a>
            </Button>
          )}
          {strip.view_meds_anchor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-1"
              onClick={() => onScrollToAnchor(strip.view_meds_anchor ?? '')}
            >
              View meds
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export function ClinicalTab({
  data,
  referralsStrip,
  labsStrip,
  medsStrip,
  loading,
  error,
  clinicalAnchor,
  onScrollToAnchor,
}: ClinicalTabProps) {
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!clinicalAnchor || !data || scrolledRef.current) return;
    scrolledRef.current = true;
    onScrollToAnchor(clinicalAnchor);
  }, [clinicalAnchor, data, onScrollToAnchor]);

  if (loading) {
    return <em>Loading clinical summary…</em>;
  }

  if (error) {
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  if (!data) return null;

  const immunizations = data.immunizations;

  return (
    <>
      <ClinicalBackground section={data.background ?? {}} />
      <ClinicalListSectionBlock
        title="Problems"
        section={data.problems ?? {}}
        emptyLabel="No active problems."
      />
      <ClinicalListSectionBlock
        title="Allergies"
        section={data.allergies ?? {}}
        emptyLabel="No allergies on file."
      />
      <ClinicalListSectionBlock
        title="Medications"
        section={data.medications ?? {}}
        emptyLabel="No active medications."
      />
      {!immunizations?.hidden && (
        <ClinicalListSectionBlock
          title="Immunizations"
          section={immunizations ?? {}}
          emptyLabel="No immunizations on file."
        />
      )}
      {referralsStrip && <ReferralsStrip strip={referralsStrip} />}
      {labsStrip && <LabsStrip strip={labsStrip} onScrollToAnchor={onScrollToAnchor} />}
      <ClinicalListSectionBlock title="Labs" section={data.labs ?? {}} emptyLabel="No lab orders on file." />
      {medsStrip && <MedsStrip strip={medsStrip} onScrollToAnchor={onScrollToAnchor} />}
      <ClinicalVitals section={data.vitals ?? {}} />
      <ClinicalThisVisit section={data.this_visit ?? {}} />
    </>
  );
}

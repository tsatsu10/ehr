import { IdCard } from 'lucide-react';
import { ChartSection } from './chartUi';
import type { RegistrationGetData } from './patientChartTypes';

/**
 * D-PROF-1 — read-only view of the patient's demographic details on the Profile tab.
 * The values are already returned by patients.registration.get (getFormData); this simply
 * renders the non-empty ones so staff can SEE the information without opening the edit form,
 * and so roles without edit rights can see it at all.
 */

function ddmmyyyy(value?: string): string {
  const v = (value ?? '').trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function ProfileInfoPanel({ data }: { data: RegistrationGetData | null }) {
  const s1 = data?.section_1 ?? {};
  const s2 = data?.section_2 ?? {};
  const s3 = data?.section_3 ?? {};
  const s4 = data?.section_4 ?? {};

  const fullName = [s1.fname, s1.mname, s1.lname].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  const age = s1.age_years != null && `${s1.age_years}` !== '' ? `${s1.age_years} yrs` : '';
  const dob = ddmmyyyy(s1.DOB);
  const emergency = [s1.reach_contact_name || s2.emergency_contact_name, s1.reach_contact_phone || s2.emergency_contact_phone, s1.reach_contact_relationship]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ');

  const fields: { label: string; value: string }[] = [
    { label: 'Full name', value: fullName },
    { label: 'Sex', value: (s1.sex ?? '').trim() },
    { label: 'Date of birth', value: dob },
    { label: 'Age', value: dob ? '' : age },
    { label: 'Phone', value: (s1.phone ?? '').trim() },
    { label: 'Other phone', value: (s2.phone_home ?? '').trim() },
    { label: 'Email', value: (s2.email ?? '').trim() },
    { label: 'National ID', value: (s1.national_id ?? '').trim() },
    { label: 'Street address', value: (s2.street ?? '').trim() },
    { label: 'Landmark', value: (s2.landmark ?? '').trim() },
    { label: 'Place of birth', value: (s2.place_of_birth ?? '').trim() },
    { label: 'Nationality', value: (s2.nationality ?? '').trim() },
    { label: 'Emergency contact', value: emergency },
    { label: 'Blood group', value: (s3.blood_group ?? '').trim() },
    { label: 'Occupation', value: (s3.occupation ?? '').trim() },
    { label: 'Religion', value: (s3.religion ?? '').trim() },
    { label: 'Education', value: (s3.education_level ?? '').trim() },
    { label: 'Insurance', value: (s4.insurance_label ?? '').trim() },
  ].filter((f) => f.value !== '');

  return (
    <ChartSection
      id="nc-profile-info"
      title="Patient information"
      icon={<IdCard className="h-4 w-4" aria-hidden />}
      bodyClassName="py-3"
    >
      {fields.length ? (
        <dl className="mb-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-[var(--oe-nc-text-muted)]">{f.label}</dt>
              <dd className="mb-0 text-sm text-[var(--oe-nc-text)]">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No details recorded yet.</p>
      )}
    </ChartSection>
  );
}

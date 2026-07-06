import { emptySections } from './encounterConsultTypes';
import { isEncounterSectionComplete } from './encounterSectionComplete';

describe('isEncounterSectionComplete', () => {
  it('marks chief complaint complete when text is present', () => {
    const sections = emptySections();
    sections.cc.chief_complaint = 'Fever';

    expect(isEncounterSectionComplete('cc', sections, 'general_opd')).toBe(true);
  });

  it('requires attestation for referral variant', () => {
    const sections = emptySections();

    expect(isEncounterSectionComplete('attestation', sections, 'referral_consult')).toBe(false);

    sections.attestation.supervisor_attested = true;
    expect(isEncounterSectionComplete('attestation', sections, 'referral_consult')).toBe(true);
  });
});

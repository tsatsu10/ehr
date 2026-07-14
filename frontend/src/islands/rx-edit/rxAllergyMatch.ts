/**
 * Client-side port of PharmOpsSafetyService::hasDrugAllergyWarning (PHP) --
 * kept in exact lockstep so the warning fires for a typed drug name too, not
 * only for a name picked from the formulary search dropdown. See
 * PrescriptionEditServiceTest::testAllergyMatchUsesSharedSafetyService for
 * the PHP-side behavior this must match: literal token/substring matching,
 * NOT a drug-class lookup (won't catch "Amoxicillin" against a documented
 * "Penicillin" allergy).
 */

const NKDA_LABELS = new Set([
  'nkda',
  'nka',
  'no known allergies',
  'no known allergy',
  'no known drug allergies',
  'no known drug allergy',
  'none known',
  'no allergy',
  'no allergies',
]);

function normalizeTokens(text: string): string[] {
  const trimmed = text.toLowerCase().trim();
  if (trimmed === '') return [];
  const parts = trimmed.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = parts.filter((part) => part.length >= 3);
  return Array.from(new Set(tokens));
}

export function hasDrugAllergyWarning(drugName: string, allergies: string[]): boolean {
  const drugTokens = normalizeTokens(drugName);
  if (drugTokens.length === 0) return false;
  const drugHaystack = drugTokens.join(' ');

  for (const rawAllergy of allergies) {
    const allergy = rawAllergy.trim();
    if (allergy === '' || NKDA_LABELS.has(allergy.toLowerCase())) continue;

    const allergyTokens = normalizeTokens(allergy);
    if (allergyTokens.some((token) => drugTokens.includes(token))) return true;

    const allergyLower = allergy.toLowerCase();
    if (allergyLower.length >= 4 && drugHaystack.includes(allergyLower)) return true;
  }

  return false;
}

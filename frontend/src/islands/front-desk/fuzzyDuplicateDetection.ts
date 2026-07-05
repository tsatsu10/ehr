/**
 * Fuzzy Duplicate Detection with Confidence Scoring
 * Uses Fuse.js for intelligent name matching beyond exact matches
 */
import Fuse from 'fuse.js';

export interface DuplicateCandidate {
  pid: number;
  displayName: string;
  pubpid: string;
  dob?: string;
  phone?: string;
  confidenceScore: number; // 0-100, higher = more confident it's a duplicate
  matchReasons: string[]; // e.g., ["Name 95% match", "Phone exact match"]
}

export interface FuzzyMatchOptions {
  /** Name to search for */
  name: string;
  /** Optional DOB for secondary matching */
  dob?: string;
  /** Optional phone for secondary matching */
  phone?: string;
  /** Minimum confidence score to consider a match (0-100) */
  threshold?: number;
}

/**
 * Find potential duplicate patients using fuzzy matching
 * 
 * **Confidence Score Calculation:**
 * - Name fuzzy match: 0-70 points (Fuse.js score inverted)
 * - DOB exact match: +20 points
 * - Phone exact match: +10 points
 * 
 * **Match Quality:**
 * - 90-100: Very high confidence (likely duplicate)
 * - 70-89: High confidence (review recommended)
 * - 50-69: Medium confidence (possible duplicate)
 * - <50: Low confidence (unlikely duplicate)
 * 
 * @example
 * const duplicates = findFuzzyDuplicates({
 *   name: "John Smith",
 *   dob: "1980-05-15",
 *   phone: "555-1234",
 *   threshold: 70,
 * }, existingPatients);
 */
export function findFuzzyDuplicates(
  options: FuzzyMatchOptions,
  existingPatients: Array<{
    pid: number;
    display_name: string;
    pubpid: string;
    dob?: string;
    phone_masked?: string;
  }>
): DuplicateCandidate[] {
  const { name, dob, phone, threshold = 50 } = options;

  if (!name || name.trim().length < 2) {
    return [];
  }

  // Configure Fuse.js for name matching
  const fuse = new Fuse(existingPatients, {
    keys: ['display_name'],
    threshold: 0.4, // 0 = exact, 1 = match anything (0.4 = moderate fuzziness)
    distance: 100,  // Max character distance to consider
    minMatchCharLength: 2,
    includeScore: true,
    useExtendedSearch: false,
  });

  // Search for name matches
  const nameMatches = fuse.search(name);

  // Score each match
  const candidates: DuplicateCandidate[] = nameMatches
    .map((result) => {
      const patient = result.item;
      const matchReasons: string[] = [];
      
      // Name score: Fuse returns 0 (perfect) to 1 (no match)
      // Invert and scale to 0-70 points
      const fuseScore = result.score ?? 1;
      const nameScore = Math.round((1 - fuseScore) * 70);
      const namePercentage = Math.round((1 - fuseScore) * 100);
      matchReasons.push(`Name ${namePercentage}% match`);

      // DOB bonus: +20 points for exact match
      let dobScore = 0;
      if (dob && patient.dob) {
        const normalizedInputDob = dob.replace(/[^\d]/g, '');
        const normalizedPatientDob = patient.dob.replace(/[^\d]/g, '');
        if (normalizedInputDob === normalizedPatientDob) {
          dobScore = 20;
          matchReasons.push('DOB exact match');
        }
      }

      // Phone bonus: +10 points for exact match
      let phoneScore = 0;
      if (phone && patient.phone_masked) {
        const normalizedInputPhone = phone.replace(/[^\d]/g, '');
        const normalizedPatientPhone = patient.phone_masked.replace(/[^\d]/g, '');
        if (
          normalizedInputPhone &&
          normalizedPatientPhone &&
          normalizedInputPhone === normalizedPatientPhone
        ) {
          phoneScore = 10;
          matchReasons.push('Phone exact match');
        }
      }

      const confidenceScore = nameScore + dobScore + phoneScore;

      return {
        pid: patient.pid,
        displayName: patient.display_name,
        pubpid: patient.pubpid,
        dob: patient.dob,
        phone: patient.phone_masked,
        confidenceScore,
        matchReasons,
      };
    })
    .filter((candidate) => candidate.confidenceScore >= threshold)
    .sort((a, b) => b.confidenceScore - a.confidenceScore); // Highest confidence first

  return candidates;
}

/**
 * Get human-readable confidence level label
 */
export function getConfidenceLabel(score: number): {
  label: string;
  variant: 'danger' | 'warning' | 'info';
} {
  if (score >= 90) {
    return { label: 'Very High', variant: 'danger' };
  } else if (score >= 70) {
    return { label: 'High', variant: 'danger' };
  } else if (score >= 50) {
    return { label: 'Medium', variant: 'warning' };
  } else {
    return { label: 'Low', variant: 'info' };
  }
}

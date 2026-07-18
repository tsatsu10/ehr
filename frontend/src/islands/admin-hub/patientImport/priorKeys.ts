import type { AcceptedKeyBuckets } from './types';

/**
 * M2: cross-chunk duplicate prediction for dry runs (and commits). The panel
 * accumulates each chunk's 'accepted_keys' response across a single run and
 * echoes the running total back as 'prior_keys' on every later chunk request,
 * so a repeat that lands in chunk 2 is predicted as a duplicate even though it
 * never touched the DB and isn't in chunk 1's in-memory index. Extracted here
 * (rather than inlined in the component) so it's unit-testable on its own.
 */
export function emptyAcceptedKeys(): AcceptedKeyBuckets {
  return { name_dob: [], name_phone: [], national_id: [] };
}

export function mergeAcceptedKeys(
  target: AcceptedKeyBuckets,
  incoming: AcceptedKeyBuckets | undefined
): AcceptedKeyBuckets {
  if (!incoming) return target;
  return {
    name_dob: [...target.name_dob, ...incoming.name_dob],
    name_phone: [...target.name_phone, ...incoming.name_phone],
    national_id: [...target.national_id, ...incoming.national_id],
  };
}

export function hasAcceptedKeys(keys: AcceptedKeyBuckets): boolean {
  return keys.name_dob.length > 0 || keys.name_phone.length > 0 || keys.national_id.length > 0;
}

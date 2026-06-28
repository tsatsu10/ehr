import { SECTION_COMPLETION_KEYS } from './registrationFormConstants';

export function parseSearchQuery(query: string): { fname: string; lname: string; phone: string } {
  const trimmed = query.trim();
  if (!trimmed) return { fname: '', lname: '', phone: '' };

  const compact = trimmed.replace(/\s+/g, '');
  const digitCount = (compact.match(/\d/g) || []).length;
  if (digitCount / compact.length >= 0.7) {
    return { fname: '', lname: '', phone: trimmed };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { fname: '', lname: parts[0], phone: '' };
  return { fname: parts[0], lname: parts.slice(1).join(' '), phone: '' };
}

export function sectionComplete(section: number, missing: string[]): boolean {
  const keys = SECTION_COMPLETION_KEYS[section] ?? [];
  if (!keys.length) return false;
  const missingSet = new Set(missing);
  return keys.every((key) => !missingSet.has(key));
}

export function tagsToString(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

export function stringToTags(value: string): string {
  return value.trim();
}

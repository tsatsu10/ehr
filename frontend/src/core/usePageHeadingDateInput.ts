import { useEffect } from 'react';

/** Two-way bind a Twig page-heading `<input type="date">` to React state. */
export function usePageHeadingDateInput(
  inputId: string,
  value: string,
  onChange: (date: string) => void
): void {
  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input || input.value === value) return undefined;
    input.value = value;
    return undefined;
  }, [inputId, value]);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return undefined;

    const handler = () => onChange(input.value);
    input.addEventListener('change', handler);
    return () => input.removeEventListener('change', handler);
  }, [inputId, onChange]);
}

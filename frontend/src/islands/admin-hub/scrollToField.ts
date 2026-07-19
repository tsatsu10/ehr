/** ADM-1: scroll a search-jump target into view and flash-highlight it. */
export function scrollToAndFlashField(fieldKey: string): void {
  const el = document.getElementById(`nc-admin-field-row-${fieldKey}`);
  if (!el) {
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('nc-admin-field-flash');
  window.setTimeout(() => el.classList.remove('nc-admin-field-flash'), 1700);
}

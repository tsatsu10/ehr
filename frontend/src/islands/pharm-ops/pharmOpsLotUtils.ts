/** FEFO lot label for dispense and OTC drawers. */
export function formatFefoLotLabel(lot: {
  lot_number?: string | null;
  expiration?: string | null;
  warehouse?: string | null;
} | null | undefined): string | null {
  if (!lot?.lot_number) return null;
  const parts = [`Lot ${lot.lot_number}`];
  if (lot.expiration && !lot.expiration.startsWith('0000')) {
    parts.push(`exp ${lot.expiration}`);
  }
  if (lot.warehouse) {
    parts.push(lot.warehouse);
  }
  return parts.join(' · ');
}

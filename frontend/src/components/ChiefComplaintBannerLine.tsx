interface ChiefComplaintBannerLineProps {
  text: string;
  draft?: boolean;
  id?: string;
}

/** Tier 1 one-liner for `new_visit.chief_complaint` (PAGE_DESIGNS §4.11.1). */
export function ChiefComplaintBannerLine({
  text,
  draft = false,
  id = 'nc-banner-chief-complaint',
}: ChiefComplaintBannerLineProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    <p
      className={`nc-banner-chief-complaint m-0 mb-3 rounded-lg border border-(--oe-nc-border) bg-(--oe-nc-bg-tint) px-3 py-2 text-sm leading-snug ${
        draft ? 'text-(--oe-nc-text-muted)' : 'text-(--oe-nc-text)'
      }`}
      id={id}
    >
      <span className="font-medium text-(--oe-nc-text-muted)">Reason for visit:</span>{' '}
      <span className={draft ? 'italic' : undefined}>{trimmed}</span>
      {draft && <span className="sr-only"> (draft)</span>}
    </p>
  );
}

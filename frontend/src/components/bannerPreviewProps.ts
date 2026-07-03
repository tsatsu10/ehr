import type { PatientPreview } from '@core/types';

export function bannerPropsFromPreview(preview: PatientPreview): {
  bannerMrdDeepLinks: boolean;
  showAllergyCountChip: boolean;
} {
  return {
    bannerMrdDeepLinks: !!preview.banner_mrd_deep_links,
    showAllergyCountChip: !!preview.allergy_count_chip,
  };
}

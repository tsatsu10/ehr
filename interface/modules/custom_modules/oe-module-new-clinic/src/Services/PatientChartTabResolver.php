<?php

/**
 * Role-default landing tab for patient chart (MRD D-MRD-13)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PatientChartTabResolver
{
    /** @var array<int, string> */
    public const ALLOWED_TABS = ['overview', 'profile', 'visits', 'clinical', 'messages'];

    public function resolve(?string $requestedTab, string $roleAco): string
    {
        $requestedTab = strtolower(trim((string) ($requestedTab ?? '')));
        if ($requestedTab !== '' && in_array($requestedTab, self::ALLOWED_TABS, true)) {
            return $requestedTab;
        }

        return match ($roleAco) {
            'new_reception', 'new_cashier' => 'profile',
            'new_lab', 'new_pharmacy' => 'clinical',
            default => 'overview',
        };
    }

    public function resolveClinicalAnchor(?string $requestedAnchor, string $roleAco, string $resolvedTab): ?string
    {
        $requestedAnchor = strtolower(trim((string) ($requestedAnchor ?? '')));
        if ($requestedAnchor !== '' && $this->isAllowedClinicalAnchor($requestedAnchor)) {
            return $requestedAnchor;
        }

        if ($resolvedTab !== 'clinical') {
            return null;
        }

        return match ($roleAco) {
            'new_lab' => 'clinical-labs',
            'new_pharmacy' => 'clinical-meds',
            default => null,
        };
    }

    private function isAllowedClinicalAnchor(string $anchor): bool
    {
        return in_array($anchor, [
            'clinical-background',
            'clinical-problems',
            'clinical-allergies',
            'clinical-meds',
            'clinical-immunizations',
            'clinical-vitals',
            'clinical-labs',
            'clinical-encounter-forms',
        ], true);
    }
}

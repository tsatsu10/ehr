<?php

/**
 * M16 day-2 reporting runbooks (RR-01–RR-12)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ReportHubRunbookService
{
    /**
     * @return array<string, mixed>
     */
    public function getCatalog(): array
    {
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $reports = $modulePublic . 'reports.php';
        $hub = $modulePublic . 'report-hub/index.php';
        $adminHub = $modulePublic . 'admin.php';

        $cards = [
            $this->card('RR-01', 'Daily', 'Manager EOD close', 'M7', 'Cash, EOD open, reconciliation.', $reports . '?tab=cash'),
            $this->card('RR-02', 'Daily', 'Chase unsigned documentation', 'M7 Unsigned', 'Resolve G10 gaps before tomorrow.', $reports . '?tab=unsigned'),
            $this->card('RR-03', 'Weekly', 'Review override / bypass sample', 'M7 Bypass', 'Audit queue bypass and dup overrides.', $reports . '?tab=bypass'),
            $this->card('RR-04', 'Monthly', 'Immunization export for EPI', 'M16 Clinical', 'Native immunization lens.', $hub . '?tab=clinical'),
            $this->card('RR-05', 'Monthly', 'Destroyed / expired drugs log', 'M16 Pharmacy', 'Pharmacy compliance export.', $hub . '?tab=pharmacy'),
            $this->card('RR-06', 'Monthly', 'Receipt analytics vs daily totals', 'M16 Financial', 'Compare M16 financial lens to M7 cash.', $hub . '?tab=financial'),
            $this->card('RR-07', 'Monthly', 'OPD attendance return', 'M16 Public health', 'Ghana template when configured.', $hub . '?tab=public_health'),
            $this->card('RR-08', 'Quarterly', 'Diagnosis summary', 'M16 Clinical', 'Clinical meeting cohort review.', $hub . '?tab=clinical'),
            $this->card('RR-09', 'Inspection', 'District binder pack', 'M16 multi-lens', 'Export printed pack + audit trail.', $hub),
            $this->card('RR-10', 'Post-pilot', 'Enable report hub checklist', 'M6 + §17.4.9', 'REP-1–REP-8 green before go-live.', $adminHub . '?tab=system'),
            $this->card('RR-11', 'Any', 'Large export async job', 'M16 card', 'Use async export above threshold.', $hub),
            $this->card('RR-12', 'Year-end', 'Archive CSV exports off-site', 'Owner + IT', 'Act 843 evidence retention.', null),
        ];

        return [
            'cards' => $cards,
            'version' => 'RR-01–RR-12',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function card(
        string $id,
        string $cadence,
        string $title,
        string $screen,
        string $detail,
        ?string $url
    ): array {
        $search = strtolower(implode(' ', [$id, $cadence, $title, $screen, $detail]));

        return [
            'id' => $id,
            'cadence' => $cadence,
            'title' => $title,
            'screen' => $screen,
            'detail' => $detail,
            'url' => $url,
            'search_text' => $search,
        ];
    }
}

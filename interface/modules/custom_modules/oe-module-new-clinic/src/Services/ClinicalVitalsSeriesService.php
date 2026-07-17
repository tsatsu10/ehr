<?php

/**
 * Longitudinal vitals series for the MRD Clinical "Trends" panel (GAP-B B2, closes G9).
 *
 * Read-only aggregation of stock `form_vitals` into per-measure time series
 * (blood pressure, pulse, respiration, temperature, SpO2, weight, height, BMI,
 * head circumference). No new store, no CDR. Units follow the clinic's
 * `units_of_measure` global so labels match how vitals were entered.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Database\QueryUtils;

class ClinicalVitalsSeriesService
{
    /** Cap the window so the query and payload stay bounded (R2). */
    private const MAX_READINGS = 60;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSeries(int $pid): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if ($this->config->getInt('enable_vitals_trends', 0, $facilityId) !== 1) {
            return ['enabled' => false, 'measures' => []];
        }

        // Newest first for the LIMIT, then charted oldest→newest below.
        // form_vitals has NO encounter column — the encounter linkage lives on
        // the `forms` registry row, so join it (formdir 'vitals', not deleted).
        $rows = QueryUtils::fetchRecords(
            "SELECT v.date, f.encounter, v.bps, v.bpd, v.pulse, v.respiration, v.temperature,
                    v.weight, v.height, v.BMI, v.oxygen_saturation, v.head_circ
             FROM form_vitals v
             JOIN forms f ON f.form_id = v.id AND LOWER(f.formdir) = 'vitals' AND f.deleted = 0
             WHERE v.pid = ? AND v.activity = 1 AND v.date IS NOT NULL AND v.date != '0000-00-00 00:00:00'
             ORDER BY v.date DESC
             LIMIT " . self::MAX_READINGS,
            [$pid]
        ) ?: [];
        $rows = array_reverse($rows); // chronological for charting

        // Module convention (triage + the native vitals editor): weight/height
        // are stored raw in kg/cm; temperature per the units global — convert it
        // to °C for display like every other module surface. (The old code read
        // a misspelled global — `units_of_measure` — and always labelled lb/in
        // over kg/cm data.)
        $validation = new VitalsValidationService();
        foreach ($rows as &$row) {
            if (isset($row['temperature']) && $row['temperature'] !== null && (float) $row['temperature'] != 0.0) {
                $row['temperature'] = $validation->temperatureForEvaluation((float) $row['temperature']);
            }
        }
        unset($row);
        $weightUnit = 'kg';
        $lengthUnit = 'cm';
        $tempUnit = '°C';

        $measures = [];

        // Blood pressure — two series, combined "120/80" readings.
        $bp = $this->buildBloodPressure($rows);
        if ($bp !== null) {
            $measures[] = $bp;
        }

        foreach (
            [
                ['key' => 'pulse', 'col' => 'pulse', 'label' => 'Pulse', 'unit' => 'bpm', 'decimals' => 0],
                ['key' => 'respiration', 'col' => 'respiration', 'label' => 'Respiration', 'unit' => '/min', 'decimals' => 0],
                ['key' => 'oxygen_saturation', 'col' => 'oxygen_saturation', 'label' => 'SpO₂', 'unit' => '%', 'decimals' => 0],
                ['key' => 'temperature', 'col' => 'temperature', 'label' => 'Temperature', 'unit' => $tempUnit, 'decimals' => 1],
                ['key' => 'weight', 'col' => 'weight', 'label' => 'Weight', 'unit' => $weightUnit, 'decimals' => 1],
                ['key' => 'height', 'col' => 'height', 'label' => 'Height', 'unit' => $lengthUnit, 'decimals' => 1],
                ['key' => 'BMI', 'col' => 'BMI', 'label' => 'BMI', 'unit' => '', 'decimals' => 1],
                ['key' => 'head_circ', 'col' => 'head_circ', 'label' => 'Head circumference', 'unit' => $lengthUnit, 'decimals' => 1],
            ] as $def
        ) {
            $measure = $this->buildSingleMeasure($rows, $def);
            if ($measure !== null) {
                $measures[] = $measure;
            }
        }

        return [
            'enabled' => true,
            'measures' => $measures,
            // W11 (deep-link, not native overlay): pediatric patients get a link to
            // the stock CDC/WHO growth chart, which renders the real percentile curves
            // + this patient's points. We deliberately do NOT redraw percentiles here —
            // the repo ships those only as PNG images, not numeric LMS data.
            'growth_chart_url' => $this->buildGrowthChartUrl($pid),
        ];
    }

    /**
     * Stock growth-chart deep link for pediatric patients (<20y), else null.
     * The stock page (interface/forms/vitals/growthchart/chart.php) needs pid +
     * a CSRF token and plots against the real CDC percentile images.
     */
    private function buildGrowthChartUrl(int $pid): ?string
    {
        $row = QueryUtils::querySingleRow('SELECT DOB FROM patient_data WHERE pid = ?', [$pid]);
        $dob = is_array($row) ? trim((string) ($row['DOB'] ?? '')) : '';
        if ($dob === '' || str_starts_with($dob, '0000-00-00')) {
            return null;
        }
        try {
            $ageYears = (new \DateTime($dob))->diff(new \DateTime('today'))->y;
        } catch (\Exception) {
            return null;
        }
        if ($ageYears >= 20) {
            return null;
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot
            . '/interface/forms/vitals/growthchart/chart.php?pid='
            . urlencode((string) $pid)
            . '&csrf_token_form=' . urlencode(CsrfUtils::collectCsrfToken());
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>|null
     */
    private function buildBloodPressure(array $rows): ?array
    {
        $sys = [];
        $dia = [];
        $readings = [];
        foreach ($rows as $row) {
            $s = $this->toNumber($row['bps'] ?? null);
            $d = $this->toNumber($row['bpd'] ?? null);
            if ($s === null && $d === null) {
                continue;
            }
            $iso = (string) ($row['date'] ?? '');
            $label = $this->formatDate($iso);
            $enc = (int) ($row['encounter'] ?? 0);
            if ($s !== null) {
                $sys[] = ['iso' => $iso, 'label' => $label, 'value' => $s, 'encounter_id' => $enc];
            }
            if ($d !== null) {
                $dia[] = ['iso' => $iso, 'label' => $label, 'value' => $d, 'encounter_id' => $enc];
            }
            $display = ($s !== null ? $this->trimNum($s) : '—') . '/' . ($d !== null ? $this->trimNum($d) : '—');
            $readings[] = ['iso' => $iso, 'label' => $label, 'display' => $display, 'encounter_id' => $enc];
        }
        if ($sys === [] && $dia === []) {
            return null;
        }

        return [
            'key' => 'bp',
            'label' => 'Blood pressure',
            'unit' => 'mmHg',
            'series' => [
                ['name' => 'Systolic', 'points' => $sys],
                ['name' => 'Diastolic', 'points' => $dia],
            ],
            'readings' => $readings,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array{key: string, col: string, label: string, unit: string, decimals: int} $def
     * @return array<string, mixed>|null
     */
    private function buildSingleMeasure(array $rows, array $def): ?array
    {
        $points = [];
        $readings = [];
        foreach ($rows as $row) {
            $value = $this->toNumber($row[$def['col']] ?? null);
            if ($value === null) {
                continue;
            }
            $iso = (string) ($row['date'] ?? '');
            $label = $this->formatDate($iso);
            $enc = (int) ($row['encounter'] ?? 0);
            $rounded = round($value, $def['decimals']);
            $points[] = ['iso' => $iso, 'label' => $label, 'value' => $rounded, 'encounter_id' => $enc];
            $display = $this->trimNum($rounded) . ($def['unit'] !== '' ? ' ' . $def['unit'] : '');
            $readings[] = ['iso' => $iso, 'label' => $label, 'display' => $display, 'encounter_id' => $enc];
        }
        if ($points === []) {
            return null;
        }

        return [
            'key' => $def['key'],
            'label' => $def['label'],
            'unit' => $def['unit'],
            'series' => [['name' => $def['label'], 'points' => $points]],
            'readings' => $readings,
        ];
    }

    /**
     * Parse a stored vital to a positive number, or null. Zero/blank means
     * "not recorded" for every form_vitals measure (all default to 0).
     */
    private function toNumber(mixed $raw): ?float
    {
        if ($raw === null) {
            return null;
        }
        $str = trim((string) $raw);
        if ($str === '' || !is_numeric($str)) {
            return null;
        }
        $value = (float) $str;

        return $value > 0 ? $value : null;
    }

    private function trimNum(float $value): string
    {
        // Drop trailing .0 so "72.0" reads "72" but "36.6" stays.
        $formatted = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }

    private function formatDate(?string $date): string
    {
        if (empty($date) || str_starts_with((string) $date, '0000-00-00')) {
            return '';
        }
        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return '';
        }
    }
}

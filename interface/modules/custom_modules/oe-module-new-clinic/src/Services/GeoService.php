<?php

/**
 * Ghana region / district lookup for registration (M1b §9)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class GeoService
{
  /** @var array<string, mixed>|null */
    private static ?array $cache = null;

    /**
     * @return array<int, array{code: string, label: string}>
     */
    public function listRegions(string $country = 'GH'): array
    {
        $data = $this->loadData();
        if (strtoupper($country) !== 'GH' || empty($data['regions'])) {
            return [];
        }

        return array_map(static function (array $region): array {
            return [
                'code' => (string) ($region['code'] ?? ''),
                'label' => (string) ($region['label'] ?? ''),
            ];
        }, $data['regions']);
    }

    /**
     * @return array<int, array{code: string, label: string}>
     */
    public function listDistricts(string $regionCode): array
    {
        $regionCode = strtoupper(trim($regionCode));
        if ($regionCode === '') {
            return [];
        }

        foreach ($this->loadData()['regions'] ?? [] as $region) {
            if (strtoupper((string) ($region['code'] ?? '')) !== $regionCode) {
                continue;
            }

            $districts = [];
            foreach ($region['districts'] ?? [] as $district) {
                $districts[] = [
                    'code' => (string) ($district['code'] ?? ''),
                    'label' => (string) ($district['label'] ?? ''),
                ];
            }

            return $districts;
        }

        return [];
    }

    public function validateDistrictInRegion(string $regionCode, string $districtCode): bool
    {
        $districtCode = strtoupper(trim($districtCode));
        if ($districtCode === '') {
            return false;
        }

        foreach ($this->listDistricts($regionCode) as $district) {
            if (strtoupper($district['code']) === $districtCode) {
                return true;
            }
        }

        return false;
    }

    public function regionLabel(string $regionCode): string
    {
        foreach ($this->listRegions() as $region) {
            if (strtoupper($region['code']) === strtoupper($regionCode)) {
                return $region['label'];
            }
        }

        return '';
    }

    public function districtLabel(string $regionCode, string $districtCode): string
    {
        foreach ($this->listDistricts($regionCode) as $district) {
            if (strtoupper($district['code']) === strtoupper($districtCode)) {
                return $district['label'];
            }
        }

        return '';
    }

    /**
     * @return array<string, mixed>
     */
    private function loadData(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $path = dirname(__DIR__, 2) . '/data/ghana_regions_districts.json';
        if (!is_readable($path)) {
            self::$cache = ['regions' => []];

            return self::$cache;
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        self::$cache = is_array($decoded) ? $decoded : ['regions' => []];

        return self::$cache;
    }
}

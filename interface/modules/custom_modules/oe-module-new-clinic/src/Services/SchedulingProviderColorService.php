<?php

/**
 * Per-facility provider calendar colours (S1 wayfinding)
 *
 * Core OpenEMR colours calendar events by category or facility, never by
 * provider. New Clinic's multi-provider day/week views want a stable colour
 * per provider so a receptionist can tell columns apart at a glance. This
 * service stores an admin-customisable map and always resolves a full colour
 * for every provider (a curated default palette cycled by list position when
 * the admin hasn't picked one), so the calendar has a single source of truth.
 *
 * Storage: one JSON blob in new_clinic_config key `scheduling_provider_colors`
 * ({providerId: "#rrggbb"}), facility-scoped — no schema change.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class SchedulingProviderColorService
{
    private const CONFIG_KEY = 'scheduling_provider_colors';

    /**
     * Curated default palette — distinct, legible solid hues (mirrors the
     * Console 26 role-accent family). Cycled by the provider's position in
     * the facility's calendar-provider list.
     *
     * @var list<string>
     */
    public const DEFAULT_PALETTE = [
        '#0071e3', // blue
        '#2bb350', // green
        '#bf5af2', // purple
        '#ff6a00', // orange
        '#2fb8cf', // teal
        '#ff2d92', // pink
        '#a2845e', // brown
        '#8e8e93', // grey
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly SchedulingShellService $shell = new SchedulingShellService(),
    ) {
    }

    /** Default colour for a provider by its index in the ordered provider list. */
    public static function defaultColorForIndex(int $index): string
    {
        $palette = self::DEFAULT_PALETTE;

        return $palette[(($index % count($palette)) + count($palette)) % count($palette)];
    }

    /**
     * Resolved colour for every provider id passed in — the saved custom
     * colour when present, else a palette default by list position. Used by
     * the calendar payload so custom picks flow straight through.
     *
     * @param list<int> $orderedProviderIds provider ids in display order
     * @return array<int, string> providerId => "#rrggbb"
     */
    public function resolveColors(array $orderedProviderIds, int $facilityId): array
    {
        $saved = $this->loadSaved($facilityId);
        $colors = [];
        $index = 0;
        foreach ($orderedProviderIds as $providerId) {
            $providerId = (int) $providerId;
            if ($providerId <= 0) {
                continue;
            }
            $colors[$providerId] = $saved[$providerId] ?? self::defaultColorForIndex($index);
            $index++;
        }

        return $colors;
    }

    /**
     * Admin payload: every calendar provider with its resolved colour and
     * whether that colour is a custom pick or a palette default.
     *
     * @return array<string, mixed>
     */
    public function getAdminPayload(int $facilityId): array
    {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);

        $providers = $this->shell->getBootstrapPayload($facilityId)['providers'];
        $saved = $this->loadSaved($facilityId);

        $rows = [];
        $index = 0;
        foreach ($providers as $provider) {
            $id = (int) ($provider['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $isCustom = isset($saved[$id]);
            $rows[] = [
                'id' => $id,
                'label' => (string) ($provider['label'] ?? ('Provider ' . $id)),
                'color' => $isCustom ? $saved[$id] : self::defaultColorForIndex($index),
                'is_custom' => $isCustom,
                'default_color' => self::defaultColorForIndex($index),
            ];
            $index++;
        }

        return ['facility_id' => $facilityId, 'providers' => $rows];
    }

    /**
     * Persist the custom colour map. A provider whose colour equals its
     * palette default (or is blank) is dropped from storage, so "reset to
     * default" is just clearing the pick — the calendar recomputes it.
     *
     * @param array<int|string, mixed> $input providerId => "#rrggbb"
     * @return array<string, mixed> fresh admin payload
     */
    public function saveColors(int $facilityId, array $input): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Scheduling write permission denied', 403);
        }
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);

        // Only providers actually on this facility's calendar may be coloured.
        $providers = $this->shell->getBootstrapPayload($facilityId)['providers'];
        $defaultByProvider = [];
        $index = 0;
        foreach ($providers as $provider) {
            $id = (int) ($provider['id'] ?? 0);
            if ($id > 0) {
                $defaultByProvider[$id] = self::defaultColorForIndex($index);
                $index++;
            }
        }

        $map = [];
        foreach ($input as $providerId => $color) {
            $providerId = (int) $providerId;
            if (!isset($defaultByProvider[$providerId])) {
                continue;
            }
            $hex = $this->normalizeHex((string) $color);
            if ($hex === null) {
                continue;
            }
            if (strcasecmp($hex, $defaultByProvider[$providerId]) === 0) {
                continue; // equals default → store nothing
            }
            $map[$providerId] = $hex;
        }

        $this->config->set(self::CONFIG_KEY, (string) json_encode($map, JSON_UNESCAPED_SLASHES), $facilityId);

        return $this->getAdminPayload($facilityId);
    }

    /**
     * @return array<int, string> saved providerId => "#rrggbb"
     */
    private function loadSaved(int $facilityId): array
    {
        $raw = $this->config->get(self::CONFIG_KEY, '', $facilityId);
        if ($raw === null || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }
        $map = [];
        foreach ($decoded as $providerId => $color) {
            $hex = $this->normalizeHex((string) $color);
            if ((int) $providerId > 0 && $hex !== null) {
                $map[(int) $providerId] = $hex;
            }
        }

        return $map;
    }

    /** Validate + normalise a "#rrggbb" hex; null when malformed. */
    private function normalizeHex(string $color): ?string
    {
        $color = trim($color);
        if (preg_match('/^#[0-9a-fA-F]{6}$/', $color) !== 1) {
            return null;
        }

        return strtolower($color);
    }
}

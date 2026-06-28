<?php

/**
 * Simple session rate limiter (SEC06)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class RateLimitService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService()
    ) {
    }

    public function assertWithinLimit(string $action, int $userId): void
    {
        $key = 'new_clinic_rate_' . $action;
        $limit = match ($action) {
            'patients.search' => $this->config->getInt('rate_limit_patients_search', 30),
            'patients.dup_check' => $this->config->getInt('rate_limit_dup_check', 60),
            default => 60,
        };

        $bucket = $_SESSION[$key] ?? ['minute' => date('Y-m-d H:i'), 'count' => 0];
        $currentMinute = date('Y-m-d H:i');

        if (($bucket['minute'] ?? '') !== $currentMinute) {
            $bucket = ['minute' => $currentMinute, 'count' => 0];
        }

        $bucket['count'] = (int) ($bucket['count'] ?? 0) + 1;
        $_SESSION[$key] = $bucket;

        if ($bucket['count'] > $limit) {
            throw new \RuntimeException('Rate limit exceeded', 429);
        }
    }
}

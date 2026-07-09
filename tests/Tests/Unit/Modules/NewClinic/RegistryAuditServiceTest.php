<?php

/**
 * Integration tests for Patient Registry audit events (M10 §17 / AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\RegistryAuditService;
use PHPUnit\Framework\TestCase;

class RegistryAuditServiceTest extends TestCase
{
    public function testLogSearchWritesRegistryAuditEvent(): void
    {
        $marker = 'phone=' . uniqid();

        (new RegistryAuditService())->logSearch($marker, 7, 42);

        $this->assertTrue($this->recentRegistryLogContains($marker, 'search user_id=42 total=7'));
    }

    public function testLogExportWritesRegistryAuditEvent(): void
    {
        $marker = 'cohort=' . uniqid();

        (new RegistryAuditService())->logExport($marker, 12, 42);

        $this->assertTrue($this->recentRegistryLogContains($marker, 'export user_id=42 rows=12'));
    }

    private function recentRegistryLogContains(string $marker, string $prefix): bool
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT comments FROM log WHERE event = 'new_registry' ORDER BY id DESC LIMIT 10"
        ) ?: [];

        foreach ($rows as $row) {
            $comments = (string) ($row['comments'] ?? '');
            $decoded = base64_decode($comments, true);
            if (is_string($decoded) && $decoded !== '') {
                $comments = $decoded;
            }
            if (str_contains($comments, $marker) && str_contains($comments, $prefix)) {
                return true;
            }
        }

        return false;
    }
}

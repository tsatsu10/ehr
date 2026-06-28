<?php

/**
 * Unit tests for Communications Hub user preference normalization
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CommHubUserSettingsService;
use PHPUnit\Framework\TestCase;

class CommHubUserSettingsServiceTest extends TestCase
{
    public function testNormalizeLensRejectsInvalid(): void
    {
        $this->assertSame('messages', CommHubUserSettingsService::normalizeLens('invalid'));
        $this->assertSame('reminders', CommHubUserSettingsService::normalizeLens('reminders'));
    }

    public function testNormalizeActivityRejectsInvalid(): void
    {
        $this->assertSame('1', CommHubUserSettingsService::normalizeActivity('bogus'));
        $this->assertSame('all', CommHubUserSettingsService::normalizeActivity('all'));
    }

    public function testNormalizeScope(): void
    {
        $this->assertSame('my', CommHubUserSettingsService::normalizeScope('my'));
        $this->assertSame('all_users', CommHubUserSettingsService::normalizeScope('all_users'));
        $this->assertSame('my', CommHubUserSettingsService::normalizeScope('admin'));
    }

    public function testNormalizeSortDefaults(): void
    {
        $this->assertSame(
            ['sortby' => 'pnotes.date', 'sortorder' => 'desc'],
            CommHubUserSettingsService::normalizeSort(null)
        );
    }

    public function testNormalizeSortFromJsonString(): void
    {
        $this->assertSame(
            ['sortby' => 'users.lname', 'sortorder' => 'asc'],
            CommHubUserSettingsService::normalizeSort('{"sortby":"users.lname","sortorder":"asc"}')
        );
    }

    public function testNormalizeSortRejectsUnknownColumn(): void
    {
        $this->assertSame(
            ['sortby' => 'pnotes.date', 'sortorder' => 'desc'],
            CommHubUserSettingsService::normalizeSort(['sortby' => 'evil.column', 'sortorder' => 'asc'])
        );
    }
}

<?php

/**
 * ClinicalIssueEditorService guard tests (GAP-D D4).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalIssueEditorService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ClinicalIssueEditorServiceTest extends TestCase
{
    /** @var array<int, string|null> facility_id => original value (null = no row) */
    private array $savedFlag = [];

    /**
     * These are live-DB integration guards: they assert flag-OFF behavior, but a
     * pilot facility may legitimately have the flag toggled ON. Pin the flag OFF
     * for the test and restore the real values afterwards — the suite must not
     * depend on ambient clinic configuration.
     */
    protected function setUp(): void
    {
        $rows = \sqlStatement("SELECT facility_id, config_value FROM new_clinic_config WHERE config_key = 'enable_native_issue_editor'");
        while ($row = \sqlFetchArray($rows)) {
            $this->savedFlag[(int) $row['facility_id']] = (string) $row['config_value'];
        }
        $cfg = new ClinicConfigService();
        foreach (array_keys($this->savedFlag) as $facilityId) {
            $cfg->set('enable_native_issue_editor', '0', $facilityId);
        }
        $cfg->invalidate();
    }

    protected function tearDown(): void
    {
        $cfg = new ClinicConfigService();
        foreach ($this->savedFlag as $facilityId => $value) {
            $cfg->set('enable_native_issue_editor', (string) $value, $facilityId);
        }
        $cfg->invalidate();
    }

    public function testDisabledByDefault(): void
    {
        $this->assertFalse((new ClinicalIssueEditorService())->isEnabled());
    }

    public function testSaveRefusedWhenDisabled(): void
    {
        // Flag OFF (default) → refuse before touching the lists table.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not enabled');
        (new ClinicalIssueEditorService())->saveIssue(1, ['type' => 'medical_problem', 'title' => 'X'], 1);
    }

    public function testGetIssueRejectsInvalidReference(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new ClinicalIssueEditorService())->getIssue(0, 0);
    }

    public function testNormalizeDateValidatesFormat(): void
    {
        $method = new ReflectionMethod(ClinicalIssueEditorService::class, 'normalizeDate');
        $method->setAccessible(true);
        $service = new ClinicalIssueEditorService();

        $this->assertNull($method->invoke($service, ''));
        $this->assertSame('2026-07-12', $method->invoke($service, '2026-07-12'));

        $this->expectException(\InvalidArgumentException::class);
        $method->invoke($service, '12/07/2026');
    }

    public function testEditableTypesAreCanonical(): void
    {
        $this->assertContains('medical_problem', ClinicalIssueEditorService::EDITABLE_TYPES);
        $this->assertContains('allergy', ClinicalIssueEditorService::EDITABLE_TYPES);
        $this->assertContains('medication', ClinicalIssueEditorService::EDITABLE_TYPES);
    }
}

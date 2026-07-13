<?php

/**
 * AdminListEditorService allow-list guard tests (GAP-C C3).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminListEditorService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class AdminListEditorServiceTest extends TestCase
{
    public function testAllowListCoversModuleConsumedLists(): void
    {
        // Every allow-listed list must be one the module actually reads.
        $this->assertArrayHasKey('immunizations', AdminListEditorService::EDITABLE_LISTS);
        $this->assertArrayHasKey('external_patient_education', AdminListEditorService::EDITABLE_LISTS);
        $this->assertArrayHasKey('note_type', AdminListEditorService::EDITABLE_LISTS);
        // payment_method is hardcoded by the cashier — must NOT be offered here.
        $this->assertArrayNotHasKey('payment_method', AdminListEditorService::EDITABLE_LISTS);
        // abook_type's option_value drives person-vs-company rendering in stock
        // addrbook_edit.php (2026-07-13 W7 research finding); this service's
        // saveOption() never sets option_value, so a clinic-created category
        // would silently misrender there. Must stay off this allow-list until
        // the editor gains an option_value control for this specific list.
        $this->assertArrayNotHasKey('abook_type', AdminListEditorService::EDITABLE_LISTS);
    }

    public function testGetOptionsRejectsNonEditableList(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('not editable');
        (new AdminListEditorService())->getOptions('rule_action');
    }

    public function testSaveOptionRejectsNonEditableList(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('not editable');
        (new AdminListEditorService())->saveOption('language', ['title' => 'x'], 1);
    }

    public function testSaveOptionRejectsBlankLabel(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('label is required');
        (new AdminListEditorService())->saveOption('note_type', ['title' => '   '], 1);
    }

    public function testUniqueOptionIdSlugifies(): void
    {
        $method = new ReflectionMethod(AdminListEditorService::class, 'uniqueOptionId');
        $method->setAccessible(true);
        $service = new AdminListEditorService();
        // A brand-new label on a real list should slugify to lowercase underscores.
        $slug = $method->invoke($service, 'note_type', 'Follow-up Call!');
        $this->assertMatchesRegularExpression('/^[a-z0-9_]+$/', $slug);
        $this->assertStringContainsString('follow_up_call', $slug);
    }
}

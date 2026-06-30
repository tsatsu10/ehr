<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use PHPUnit\Framework\TestCase;

class MainMenuRestrictClinicalDocTest extends TestCase
{
    public function testVisitFormsLabelConstant(): void
    {
        $this->assertContains('Visit Forms', MainMenuRestrictService::STOCK_VISIT_FORMS_LABELS);
    }

    public function testVisitFormsHiddenLabelsIncludesTranslatedLabel(): void
    {
        $labels = MainMenuRestrictService::visitFormsHiddenLabels();
        $this->assertContains('Visit Forms', $labels);
        $this->assertContains(xl('Visit Forms'), $labels);
    }

    public function testFilterMainMenuByLabelRemovesVisitForms(): void
    {
        $visitForms = (object) [
            'label' => 'Visit Forms',
            'children' => [(object) ['label' => 'SOAP', 'url' => '/x']],
        ];
        $other = (object) ['label' => 'Issues', 'url' => '/issues'];
        $service = new MainMenuRestrictService();
        $filtered = $service->filterMainMenuByLabel([$visitForms, $other], ['Visit Forms']);
        $this->assertCount(1, $filtered);
        $this->assertSame('Issues', $filtered[0]->label);
    }
}

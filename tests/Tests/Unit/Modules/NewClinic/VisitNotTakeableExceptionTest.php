<?php

/**
 * Unit tests for visit claim-loss exception payload
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use PHPUnit\Framework\TestCase;

class VisitNotTakeableExceptionTest extends TestCase
{
    public function testContextDefaultsToEmptyArray(): void
    {
        $exception = new VisitNotTakeableException('Visit is not ready for doctor');

        $this->assertSame([], $exception->getContext());
    }

    public function testContextCarriesTakenElsewhereInterrupt(): void
    {
        $exception = new VisitNotTakeableException('Nurse Ada started triage first', [
            'interrupt' => 'taken_elsewhere',
            'claim_kind' => 'start_triage',
            'taker_display_name' => 'Ada Lovelace',
            'patient_mrn' => 'MRN-42',
            'queue_number' => '7',
        ]);

        $context = $exception->getContext();
        $this->assertSame('taken_elsewhere', $context['interrupt']);
        $this->assertSame('start_triage', $context['claim_kind']);
        $this->assertSame('Ada Lovelace', $context['taker_display_name']);
    }
}

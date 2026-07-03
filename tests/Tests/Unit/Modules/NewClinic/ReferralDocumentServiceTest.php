<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReferralDocumentService;
use PHPUnit\Framework\TestCase;

class ReferralDocumentServiceTest extends TestCase
{
    public function testRejectsEmptyUpload(): void
    {
        $service = new ReferralDocumentService();
        $this->expectException(\InvalidArgumentException::class);
        $service->assertValidUpload(['error' => UPLOAD_ERR_NO_FILE, 'size' => 0, 'name' => '']);
    }

    public function testRejectsOversizedUpload(): void
    {
        $service = new ReferralDocumentService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('10 MB');
        $service->assertValidUpload([
            'error' => UPLOAD_ERR_OK,
            'size' => ReferralDocumentService::MAX_BYTES + 1,
            'name' => 'referral.pdf',
        ]);
    }

    public function testRejectsInvalidPatientReference(): void
    {
        $service = new ReferralDocumentService();
        $this->expectException(\InvalidArgumentException::class);
        $service->assertBelongsToPatient(99, 0);
    }
}

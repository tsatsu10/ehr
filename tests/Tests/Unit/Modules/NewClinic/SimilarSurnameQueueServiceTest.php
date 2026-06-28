<?php

/**
 * Unit tests for similar-surname queue warnings (M0-F35)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SimilarSurnameQueueService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class SimilarSurnameQueueServiceTest extends TestCase
{
    public function testNormalizeSurnameCollapsesWhitespaceAndLowercases(): void
    {
        $service = new SimilarSurnameQueueService();

        $this->assertSame('mensah', $service->normalizeSurname('  MeNsah '));
        $this->assertSame('o\'konkwo', $service->normalizeSurname("O' Konkwo"));
        $this->assertSame('', $service->normalizeSurname(''));
    }

    public function testApplyFlagMarksCollisionWhenCountGreaterThanOne(): void
    {
        $service = new SimilarSurnameQueueService();
        $method = new ReflectionMethod(SimilarSurnameQueueService::class, 'applyFlag');

        $flagged = $method->invoke($service, ['lname' => 'Mensah'], ['mensah' => 2]);
        $solo = $method->invoke($service, ['lname' => 'Asante'], ['asante' => 1]);

        $this->assertTrue($flagged['similar_surname_today']);
        $this->assertFalse($solo['similar_surname_today']);
    }
}

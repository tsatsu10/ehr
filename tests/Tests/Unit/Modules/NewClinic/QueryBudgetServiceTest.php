<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\QueryBudgetService;
use PHPUnit\Framework\TestCase;

class QueryBudgetServiceTest extends TestCase
{
    public function testMariaDbUsesMaxStatementTimeInSeconds(): void
    {
        $svc = new QueryBudgetService();

        // XAMPP's handshake string (mysqli server_info) looks exactly like this.
        $this->assertSame(
            'SET SESSION max_statement_time = 10',
            $svc->statementFor('10.4.32-MariaDB', 10)
        );
        // Replica/deb builds add suffixes; the flavour match is case-insensitive.
        $this->assertSame(
            'SET SESSION max_statement_time = 10',
            $svc->statementFor('10.6.16-mariadb-0ubuntu0.22.04.1-log', 10)
        );
    }

    public function testModernMySqlUsesMaxExecutionTimeInMilliseconds(): void
    {
        $svc = new QueryBudgetService();

        $this->assertSame(
            'SET SESSION max_execution_time = 10000',
            $svc->statementFor('8.0.36', 10)
        );
        $this->assertSame(
            'SET SESSION max_execution_time = 10000',
            $svc->statementFor('5.7.44-log', 10)
        );
    }

    public function testPreTimeoutMySqlGetsNoStatement(): void
    {
        $svc = new QueryBudgetService();

        $this->assertNull($svc->statementFor('5.6.51', 10));
        $this->assertNull($svc->statementFor('', 10));
    }

    public function testBudgetIsClampedToAtLeastOneSecond(): void
    {
        $svc = new QueryBudgetService();

        $this->assertSame(
            'SET SESSION max_statement_time = 1',
            $svc->statementFor('10.4.32-MariaDB', 0)
        );
    }
}

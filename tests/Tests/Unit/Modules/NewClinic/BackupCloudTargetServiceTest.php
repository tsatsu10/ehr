<?php

/**
 * Cloud sync-folder detection/classification tests (GAP-C C6 follow-up).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\BackupCloudTargetService;
use PHPUnit\Framework\TestCase;

class BackupCloudTargetServiceTest extends TestCase
{
    public function testClassifyIdentifiesCloudProviders(): void
    {
        $s = new BackupCloudTargetService();
        $this->assertSame('OneDrive', $s->classify('C:/Users/x/OneDrive - Contoso/backups'));
        $this->assertSame('OneDrive', $s->classify('C:\\Users\\x\\OneDrive\\backups'));
        $this->assertSame('Dropbox', $s->classify('C:\\Users\\x\\Dropbox\\bk'));
        $this->assertSame('Google Drive', $s->classify('C:/Users/x/Google Drive/bk'));
        $this->assertSame('Google Drive', $s->classify('G:/My Drive/bk'));
    }

    public function testClassifyReturnsNullForLocalOrEmpty(): void
    {
        $s = new BackupCloudTargetService();
        $this->assertNull($s->classify('E:/clinic-backups'));
        $this->assertNull($s->classify('C:/xampp/htdocs/openemr/sites/default/documents/nc_backups'));
        $this->assertNull($s->classify(''));
    }

    public function testDetectFoldersReturnsArray(): void
    {
        $this->assertIsArray((new BackupCloudTargetService())->detectFolders());
    }
}

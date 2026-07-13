<?php

/**
 * Unit tests for the export file storage abstraction (SCALE-2.3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ExportStorageService;
use PHPUnit\Framework\TestCase;

class ExportStorageServiceTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/nc-export-storage-test-' . bin2hex(random_bytes(6));
        mkdir($this->root, 0700, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->root . '/*/*') ?: [] as $file) {
            @unlink($file);
        }
        foreach (glob($this->root . '/*') ?: [] as $dir) {
            @rmdir($dir);
        }
        @rmdir($this->root);
    }

    private function storage(string $namespace = 'nc_test_exports'): ExportStorageService
    {
        return new ExportStorageService($namespace, 'local', $this->root);
    }

    public function testPutThenReadRoundTrip(): void
    {
        $storage = $this->storage();
        $path = $storage->put('job-7-visits.csv', "a,b\n1,2\n");

        $this->assertTrue($storage->isStored($path));
        $this->assertSame("a,b\n1,2\n", $storage->read($path));
        $this->assertSame('job-7-visits.csv', basename($path));
    }

    public function testPutSanitizesHostileFileKey(): void
    {
        $storage = $this->storage();
        $path = $storage->put('job-9-../../etc/pass wd$.csv', 'x');

        $this->assertSame('pass-wd-.csv', basename($path));
        $this->assertStringStartsWith(
            str_replace('\\', '/', $this->root),
            str_replace('\\', '/', $path)
        );
    }

    public function testReadRefusesPathOutsideNamespaceRoot(): void
    {
        $outside = $this->root . '/secret.txt';
        file_put_contents($outside, 'not yours');

        $storage = $this->storage();
        $storage->put('job-1-a.csv', 'x'); // ensure the namespace dir exists

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionCode(404);
        $storage->read($outside);
    }

    public function testDeleteRemovesStoredFileOnly(): void
    {
        $storage = $this->storage();
        $path = $storage->put('job-2-b.csv', 'x');
        $outside = $this->root . '/keep.txt';
        file_put_contents($outside, 'keep');

        $storage->delete($path);
        $storage->delete($outside); // refused: outside the namespace root

        $this->assertFalse($storage->isStored($path));
        $this->assertFileExists($outside);
    }

    public function testPurgeOlderThanRemovesOnlyExpiredFiles(): void
    {
        $storage = $this->storage();
        $old = $storage->put('job-3-old.csv', 'old');
        $fresh = $storage->put('job-4-fresh.csv', 'fresh');
        touch($old, time() - ExportStorageService::RETENTION_SECONDS - 3600);

        $purged = $storage->purgeOlderThan();

        $this->assertSame(1, $purged);
        $this->assertFalse($storage->isStored($old));
        $this->assertTrue($storage->isStored($fresh));
    }

    public function testPurgeOnMissingDirectoryIsZero(): void
    {
        $this->assertSame(0, $this->storage('nc_never_created')->purgeOlderThan());
    }

    public function testUnknownDriverFailsLoud(): void
    {
        $storage = new ExportStorageService('nc_test_exports', 's3', $this->root);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('export_storage_driver');
        $storage->put('job-5-c.csv', 'x');
    }

    public function testInvalidNamespaceRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new ExportStorageService('../evil', 'local', $this->root);
    }
}

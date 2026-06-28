<?php

/**
 * Shared helpers for PRD §16.1 mandatory contract tests
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use PHPUnit\Framework\Assert;
use ReflectionMethod;

trait MandatoryTestHelpers
{
    protected function moduleRoot(): string
    {
        return dirname(__DIR__, 5) . '/interface/modules/custom_modules/oe-module-new-clinic';
    }

    protected function readModuleSource(string $relativePath): string
    {
        $path = $this->moduleRoot() . '/' . ltrim($relativePath, '/');
        Assert::assertFileExists($path, 'Expected module file: ' . $relativePath);

        return (string) file_get_contents($path);
    }

    protected function frontendRoot(): string
    {
        return dirname(__DIR__, 5) . '/frontend';
    }

    protected function readFrontendSource(string $relativePath): string
    {
        $path = $this->frontendRoot() . '/' . ltrim($relativePath, '/');
        Assert::assertFileExists($path, 'Expected frontend file: ' . $relativePath);

        return (string) file_get_contents($path);
    }

    protected function methodBody(string $class, string $method): string
    {
        $reflection = new ReflectionMethod($class, $method);
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);

        return implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));
    }
}

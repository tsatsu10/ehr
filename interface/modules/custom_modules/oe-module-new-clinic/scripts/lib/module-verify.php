<?php

/**
 * Shared static checks for New Clinic module PHP (constructor cycles, imports, syntax).
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

/**
 * @return list<string>
 */
function moduleVerifyRootDirs(): array
{
    $moduleRoot = dirname(__DIR__, 2);

    return [
        $moduleRoot . '/src/Services',
        $moduleRoot . '/src/Controllers',
        $moduleRoot . '/src/Support',
        $moduleRoot . '/src',
    ];
}

/**
 * @return list<string>
 */
function moduleVerifyPhpFiles(): array
{
    $files = [];
    foreach (moduleVerifyRootDirs() as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        $glob = glob($dir . '/*.php') ?: [];
        foreach ($glob as $file) {
            $files[] = $file;
        }
    }

    sort($files);

    return array_values(array_unique($files));
}

/**
 * @return list<string>
 */
function moduleVerifySyntaxErrors(array $files): array
{
    $errors = [];
    foreach ($files as $file) {
        $output = [];
        $exitCode = 0;
        exec('"' . PHP_BINARY . '" -l ' . escapeshellarg($file) . ' 2>&1', $output, $exitCode);
        if ($exitCode !== 0) {
            $errors[] = basename($file) . ': ' . implode(' ', $output);
        }
    }

    return $errors;
}

/**
 * Build constructor dependency graph from `new ClassName()` inside __construct.
 *
 * @return array<string, list<string>>
 */
function moduleVerifyCtorGraph(): array
{
    $graph = [];

    foreach (moduleVerifyPhpFiles() as $file) {
        $code = file_get_contents($file);
        if ($code === false || !preg_match('/class\s+(\w+)/', $code, $classMatch)) {
            continue;
        }
        $class = $classMatch[1];

        if (!preg_match('/function\s+__construct\s*\((.*?)\)\s*(?::\s*\w+\s*)?\{(.*?)\n    \}/s', $code, $ctorMatch)) {
            if (!preg_match('/function\s+__construct\s*\([^)]*\)\s*\{([^}]*)\}/s', $code, $ctorMatch)) {
                $graph[$class] = [];
                continue;
            }
        }

        $ctorBody = $ctorMatch[0];
        $deps = [];
        if (preg_match_all('/new\s+(\w+)\s*\(/', $ctorBody, $newMatches)) {
            $deps = array_values(array_unique($newMatches[1]));
        }
        $graph[$class] = $deps;
    }

    return $graph;
}

/**
 * @return list<list<string>>
 */
function moduleVerifyCtorCycles(array $graph): array
{
    $cycles = [];

    $visit = static function (string $node, array $stack, array &$visited) use (&$visit, $graph, &$cycles): void {
        if (in_array($node, $stack, true)) {
            $start = array_search($node, $stack, true);
            $cycle = array_merge(array_slice($stack, (int) $start), [$node]);
            $cycles[implode('->', $cycle)] = $cycle;

            return;
        }
        if (isset($visited[$node])) {
            return;
        }
        $stack[] = $node;
        foreach ($graph[$node] ?? [] as $dep) {
            if (!isset($graph[$dep])) {
                continue;
            }
            $visit($dep, $stack, $visited);
        }
        $visited[$node] = true;
    };

    $visited = [];
    foreach (array_keys($graph) as $node) {
        $visit($node, [], $visited);
    }

    return array_values($cycles);
}

/**
 * @return list<string>
 */
function moduleVerifyMissingImports(string $file): array
{
    $code = file_get_contents($file);
    if ($code === false) {
        return ['unreadable file'];
    }

    $dirOfFile = dirname($file);
    $imported = [];
    if (preg_match_all('/^use\s+([\w\\\\]+)(?:\s+as\s+(\w+))?;/m', $code, $useMatches, PREG_SET_ORDER)) {
        foreach ($useMatches as $useMatch) {
            $alias = $useMatch[2] ?? '';
            $fqcn = $useMatch[1];
            $short = $alias !== '' ? $alias : substr($fqcn, (int) strrpos($fqcn, '\\') + 1);
            $imported[$short] = $fqcn;
        }
    }

    $referenced = [];
    if (preg_match_all('/new\s+([A-Z]\w+)\s*\(|readonly\s+([A-Z]\w+)\s+\$/', $code, $refMatches, PREG_SET_ORDER)) {
        foreach ($refMatches as $refMatch) {
            foreach (array_filter([$refMatch[1] ?? '', $refMatch[2] ?? '']) as $name) {
                $referenced[$name] = true;
            }
        }
    }

    $skip = [
        'Exception', 'RuntimeException', 'InvalidArgumentException', 'Throwable',
        'DateTime', 'DateTimeImmutable', 'DateInterval', 'DateTimeZone', 'JsonException',
    ];

    $missing = [];
    foreach (array_keys($referenced) as $name) {
        if (isset($imported[$name])) {
            continue;
        }
        if (in_array($name, $skip, true)) {
            continue;
        }
        if (is_file($dirOfFile . '/' . $name . '.php')) {
            continue;
        }
        $missing[] = $name;
    }

    return $missing;
}

/**
 * @return list<string>
 */
function moduleVerifyStrayArtifacts(): array
{
    $moduleRoot = dirname(__DIR__, 2);
    $issues = [];

    foreach (glob($moduleRoot . '/src/**/*.php.broken') ?: [] as $broken) {
        $issues[] = 'stray artifact: ' . str_replace($moduleRoot . '/', '', $broken);
    }
    foreach (glob($moduleRoot . '/src/**/*.php.bak') ?: [] as $bak) {
        $issues[] = 'stray artifact: ' . str_replace($moduleRoot . '/', '', $bak);
    }

    return $issues;
}

/**
 * @return list<string>
 */
function moduleVerifyBootstrapInstantiation(): array
{
    $moduleRoot = dirname(__DIR__, 2);
    $openemrRoot = dirname($moduleRoot, 4);
    $globals = $openemrRoot . '/interface/globals.php';

    if (!is_file($globals)) {
        return ['OpenEMR globals.php not found — skip bootstrap check on this host'];
    }

  $snippet = <<<'PHP'
$ignoreAuth = true;
$_GET['site'] = 'default';
require_once %s;
new \OpenEMR\Modules\NewClinic\Controllers\AjaxController();
echo "ok";
PHP;

    $script = sprintf($snippet, var_export($globals, true));
    $tmp = tempnam(sys_get_temp_dir(), 'nc-verify-');
    if ($tmp === false) {
        return ['could not create temp script for bootstrap check'];
    }
    file_put_contents($tmp . '.php', "<?php\n" . $script);
    $output = [];
    $exitCode = 0;
    exec('"' . PHP_BINARY . '" ' . escapeshellarg($tmp . '.php') . ' 2>&1', $output, $exitCode);
    @unlink($tmp . '.php');

    if ($exitCode !== 0 || !in_array('ok', $output, true)) {
        return ['AjaxController bootstrap instantiation failed: ' . implode(' ', $output)];
    }

    return [];
}

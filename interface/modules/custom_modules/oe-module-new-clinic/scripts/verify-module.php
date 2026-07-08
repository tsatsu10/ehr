<?php

/**
 * New Clinic module verification gate — run after backend edits (especially from Cursor iOS).
 *
 * Checks: PHP syntax, constructor cycles, missing imports (AjaxController + Controllers),
 * stray .broken/.bak artifacts, optional AjaxController bootstrap instantiation.
 *
 * Usage (from repo root or module directory):
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/verify-module.php
 *   php scripts/verify-module.php --bootstrap
 *   composer verify:new-clinic
 *
 * Exit 0 = pass, 1 = fail.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/module-verify.php';
require_once __DIR__ . '/lib/ajax-action-crosscheck.php';

$withBootstrap = in_array('--bootstrap', $argv, true);
$failures = 0;

echo "New Clinic module verify\n";
echo str_repeat('-', 40) . "\n";

$files = moduleVerifyPhpFiles();
echo 'PHP files: ' . count($files) . "\n";

$syntaxErrors = moduleVerifySyntaxErrors($files);
if ($syntaxErrors === []) {
    echo "[PASS] syntax\n";
} else {
    echo "[FAIL] syntax\n";
    foreach ($syntaxErrors as $error) {
        echo "  - $error\n";
    }
    $failures++;
}

$graph = moduleVerifyCtorGraph();
$cycles = moduleVerifyCtorCycles($graph);
if ($cycles === []) {
    echo "[PASS] constructor cycles (0 found)\n";
} else {
    echo '[FAIL] constructor cycles (' . count($cycles) . " found)\n";
    foreach ($cycles as $cycle) {
        echo '  - ' . implode(' -> ', $cycle) . "\n";
    }
    $failures++;
}

$importFailures = [];
$controllersDir = str_replace('\\', '/', dirname(__DIR__)) . '/src/Controllers';
foreach ($files as $moduleFile) {
    if (!str_starts_with($moduleFile, $controllersDir . '/')) {
        continue;
    }
    $missing = moduleVerifyMissingImports($moduleFile);
    if ($missing !== []) {
        $importFailures[basename($moduleFile)] = $missing;
    }
}
if ($importFailures === []) {
    echo "[PASS] controller imports\n";
} else {
    echo "[FAIL] controller imports\n";
    foreach ($importFailures as $file => $missing) {
        echo "  - $file: " . implode(', ', $missing) . "\n";
    }
    $failures++;
}

$stray = moduleVerifyStrayArtifacts();
if ($stray === []) {
    echo "[PASS] stray artifacts\n";
} else {
    echo "[FAIL] stray artifacts\n";
    foreach ($stray as $issue) {
        echo "  - $issue\n";
    }
    $failures++;
}

if ($withBootstrap) {
    $bootstrapErrors = moduleVerifyBootstrapInstantiation();
    if ($bootstrapErrors === []) {
        echo "[PASS] AjaxController bootstrap instantiation\n";
    } else {
        $skipped = count($bootstrapErrors) === 1 && str_contains($bootstrapErrors[0], 'skip bootstrap');
        if ($skipped) {
            echo '[SKIP] ' . $bootstrapErrors[0] . "\n";
        } else {
            echo "[FAIL] AjaxController bootstrap instantiation\n";
            foreach ($bootstrapErrors as $error) {
                echo "  - $error\n";
            }
            $failures++;
        }
    }
} else {
    echo "[SKIP] bootstrap (pass --bootstrap to enable)\n";
}

$ajaxCrosscheckErrors = moduleVerifyAjaxActionCrosscheckErrors();
if ($ajaxCrosscheckErrors === []) {
    echo '[PASS] ajax action crosscheck (' . count(moduleVerifyExtractControllerActions()) . " controller actions)\n";
} else {
    echo '[FAIL] ajax action crosscheck (' . count($ajaxCrosscheckErrors) . " issue(s))\n";
    foreach ($ajaxCrosscheckErrors as $error) {
        echo "  - $error\n";
    }
    $failures++;
}

echo str_repeat('-', 40) . "\n";
if ($failures === 0) {
    echo "RESULT: PASS\n";
    exit(0);
}

echo "RESULT: FAIL ($failures check group(s))\n";
exit(1);

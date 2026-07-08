<?php

/**
 * Static cross-check: AjaxController actions ↔ AjaxActionPolicy ↔ repo callers (AUDIT-14).
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;

/**
 * Controller actions allowed to have zero repo callers (server URL, tombstones, probes).
 *
 * @return array<string, string>
 */
function moduleVerifyAjaxActionCallerAllowlist(): array
{
    return [
        'health' => 'infrastructure probe',
        'visit.transition' => 'deprecated tombstone (HTTP 410)',
        'queue_bridge.eod_export' => 'server-built download href, not oeFetch',
        // Documented APIs not yet wired to a static caller (inventory — do not add new entries casually).
        'clinical_doc.sign_status' => 'poll API in PRD; hub reads sign_status via visit_summary until poll ships',
        'doctor.routing.reassign' => 'visit-board reassignment API; V1 desks use visit.hard_assign instead',
        'lab_ops.fee_map_list' => 'fee-map read API; setup panel uses fee_map_save starter path only',
    ];
}

function moduleVerifyRegisterNewClinicAutoload(): void
{
    static $registered = false;
    if ($registered) {
        return;
    }

    $moduleRoot = dirname(__DIR__, 2);
    spl_autoload_register(static function (string $class) use ($moduleRoot): void {
        $prefix = 'OpenEMR\\Modules\\NewClinic\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }

        $relative = substr($class, strlen($prefix));
        $path = $moduleRoot . '/src/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($path)) {
            require_once $path;
        }
    });

    $registered = true;
}

function moduleVerifySingleSegmentControllerActions(): array
{
    static $actions = null;
    if ($actions !== null) {
        return $actions;
    }

    $actions = [];
    foreach (moduleVerifyExtractControllerActions() as $action) {
        if (!str_contains($action, '.')) {
            $actions[$action] = true;
        }
    }

    return $actions;
}

function moduleVerifyKnownAjaxActionRoots(): array
{
    static $roots = null;
    if ($roots !== null) {
        return $roots;
    }

    $roots = ['health' => true];
    foreach (moduleVerifyExtractControllerActions() as $action) {
        $parts = explode('.', $action);
        if ($parts[0] !== '') {
            $roots[$parts[0]] = true;
        }
    }

    return $roots;
}

function moduleVerifyLooksLikeAjaxAction(string $value): bool
{
    if (isset(moduleVerifySingleSegmentControllerActions()[$value])) {
        return true;
    }

    if (!preg_match('/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/', $value)) {
        return false;
    }

    $segments = explode('.', $value);
    if (count($segments) < 2 || count($segments) > 5) {
        return false;
    }

    return isset(moduleVerifyKnownAjaxActionRoots()[$segments[0]]);
}

/**
 * @param array<string, true> $callers
 */
function moduleVerifyRegisterCallerAction(array &$callers, string $action, AjaxActionPolicy $policy): void
{
    $normalized = $policy->normalizeAction($action);
    foreach ([$action, $normalized] as $candidate) {
        if (moduleVerifyLooksLikeAjaxAction($candidate)) {
            $callers[$candidate] = true;
        }
    }
}

/**
 * @return list<string>
 */
function moduleVerifyExtractControllerActions(): array
{
    $moduleRoot = dirname(__DIR__, 2);
    $files = [
        $moduleRoot . '/src/Controllers/AjaxController.php',
    ];

    foreach (glob($moduleRoot . '/src/Controllers/Ajax/Handlers/*.php') ?: [] as $handlerFile) {
        $files[] = $handlerFile;
    }

    $actions = [];
    foreach ($files as $file) {
        $code = file_get_contents($file);
        if ($code === false) {
            continue;
        }
        if (preg_match_all('/case\s+[\'"]([a-z][a-z0-9_.]+)[\'"]\s*:/', $code, $matches)) {
            foreach ($matches[1] as $action) {
                $actions[$action] = true;
            }
        }
    }

    ksort($actions);

    return array_keys($actions);
}

/**
 * @return array<string, true>
 */
function moduleVerifyCollectActionCallers(): array
{
    $repoRoot = dirname(__DIR__, 6);
    $moduleRoot = dirname(__DIR__, 2);

    $roots = [
        $repoRoot . '/frontend/src',
        $moduleRoot . '/public/assets/js',
        $moduleRoot . '/public/assets/modern',
        $moduleRoot . '/templates',
        $moduleRoot . '/public',
        $moduleRoot . '/scripts',
        $repoRoot . '/tests/Tests/Unit/Modules/NewClinic',
        $repoRoot . '/tests/e2e/new-clinic',
    ];

    $patterns = [
        '/oeFetch\s*(?:<[^>]+>)?\s*\(\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/oeFetch<[\s\S]*?>\s*\(\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/action:\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/restoreAction:\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/\.set\(\s*[\'"]action[\'"]\s*,\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/[?&]action=([a-z][a-z0-9_.]+)/',
        '/\?action=([a-z][a-z0-9_.]+)/',
        '/postJson\s*\(\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/fetchAction\s*\(\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
        '/`([a-z][a-z0-9_.]+)`/',
        '/[\'"]([a-z][a-z0-9_.]+)[\'"]\s*:\s*[\'"]([a-z][a-z0-9_.]+)[\'"]/',
    ];

    $callers = [];
    moduleVerifyRegisterNewClinicAutoload();
    $policy = new AjaxActionPolicy();

    foreach ($roots as $root) {
        if (!is_dir($root)) {
            continue;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }

            $path = $fileInfo->getPathname();
            $ext = strtolower($fileInfo->getExtension());
            if (!in_array($ext, ['php', 'js', 'ts', 'tsx', 'twig'], true)) {
                continue;
            }

            if (str_contains($path, DIRECTORY_SEPARATOR . 'node_modules' . DIRECTORY_SEPARATOR)) {
                continue;
            }

            if (str_ends_with($path, 'AjaxController.php')
                || str_contains($path, DIRECTORY_SEPARATOR . 'Controllers' . DIRECTORY_SEPARATOR . 'Ajax' . DIRECTORY_SEPARATOR . 'Handlers' . DIRECTORY_SEPARATOR)) {
                continue;
            }

            $contents = file_get_contents($path);
            if ($contents === false) {
                continue;
            }

            foreach ($patterns as $pattern) {
                if (!preg_match_all($pattern, $contents, $matches)) {
                    continue;
                }
                foreach ($matches as $groupIndex => $groupMatches) {
                    if ($groupIndex === 0) {
                        continue;
                    }
                    foreach ($groupMatches as $action) {
                        moduleVerifyRegisterCallerAction($callers, $action, $policy);
                    }
                }
            }
        }
    }

    return $callers;
}

/**
 * @return list<string>
 */
function moduleVerifyAjaxActionCrosscheckErrors(): array
{
    moduleVerifyRegisterNewClinicAutoload();
    $policy = new AjaxActionPolicy();

    $controllerActions = moduleVerifyExtractControllerActions();
    $callers = moduleVerifyCollectActionCallers();
    $allowlist = moduleVerifyAjaxActionCallerAllowlist();
    $errors = [];

    foreach ($controllerActions as $action) {
        $normalized = $policy->normalizeAction($action);
        if ($policy->describe($normalized)['type'] === 'unknown') {
            $errors[] = "Controller action missing from AjaxActionPolicy: {$action}";
        }
    }

    foreach (array_keys($callers) as $action) {
        if (!moduleVerifyLooksLikeAjaxAction($action)) {
            continue;
        }
        $normalized = $policy->normalizeAction($action);
        if ($policy->describe($normalized)['type'] === 'unknown') {
            $errors[] = "Caller references action not in AjaxActionPolicy: {$action}";
        }
    }

    foreach ($controllerActions as $action) {
        if (isset($allowlist[$action])) {
            continue;
        }

        $normalized = $policy->normalizeAction($action);
        if (isset($callers[$action]) || isset($callers[$normalized])) {
            continue;
        }

        $errors[] = "Ajax action has zero repo callers (add allowlist if intentional): {$action}";
    }

    $controllerSet = array_fill_keys($controllerActions, true);
    foreach (array_keys($allowlist) as $action) {
        $controllerSet[$action] = true;
    }

    foreach (array_keys($callers) as $action) {
        if (!moduleVerifyLooksLikeAjaxAction($action)) {
            continue;
        }
        $normalized = $policy->normalizeAction($action);
        if ($policy->describe($normalized)['type'] === 'unknown') {
            continue;
        }
        if (!isset($controllerSet[$action]) && !isset($controllerSet[$normalized])) {
            $errors[] = "Caller references action with no AjaxController case: {$action}";
        }
    }

    sort($errors);

    return $errors;
}

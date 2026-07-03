<?php

/**
 * Shared HTTP helpers for New Clinic pilot smoke scripts.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

/**
 * @return array{code: int, body: string}
 */
function smokeHttpRequest(string $url, string $cookieFile, ?string $postBody = null, array $headers = []): array
{
    $ch = curl_init($url);
    $defaultHeaders = $postBody !== null && $headers === []
        ? ['Content-Type: application/x-www-form-urlencoded']
        : [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => array_merge($defaultHeaders, $headers),
    ]);
    if ($postBody !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
    }
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => is_string($body) ? $body : '',
    ];
}

function smokeLoginSession(string $baseUrl, string $cookieFile, string $user, string $pass): void
{
    $loginPage = smokeHttpRequest($baseUrl . '/interface/login/login.php?site=default', $cookieFile);
    $languageChoice = '1';
    if (preg_match('/name="languageChoice"\s+value="([^"]+)"/', $loginPage['body'], $langMatch)) {
        $languageChoice = $langMatch[1];
    }

    $post = http_build_query([
        'authUser' => $user,
        'clearPass' => $pass,
        'new_login_session_management' => '1',
        'languageChoice' => $languageChoice,
        'authProvider' => 'Default',
    ]);

    smokeHttpRequest($baseUrl . '/interface/main/main_screen.php?auth=login&site=default', $cookieFile, $post);
}

function smokeResolveAbsoluteUrl(string $baseUrl, string $url): string
{
    if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
        return $url;
    }

    $parts = parse_url($baseUrl);
    $origin = ($parts['scheme'] ?? 'http') . '://' . ($parts['host'] ?? 'localhost');
    if (!empty($parts['port'])) {
        $origin .= ':' . $parts['port'];
    }

    return $origin . (str_starts_with($url, '/') ? $url : '/' . ltrim($url, '/'));
}

/**
 * @return array<string, mixed>|null
 */
function smokeExtractIslandProps(string $html, string $islandName): ?array
{
    $escaped = preg_quote($islandName, '/');
    $patterns = [
        '/data-island="' . $escaped . '"[^>]*data-props="([^"]+)"/',
        '/data-props="([^"]+)"[^>]*data-island="' . $escaped . '"/',
    ];

    foreach ($patterns as $pattern) {
        if (!preg_match($pattern, $html, $match)) {
            continue;
        }

        $json = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        $decoded = json_decode($json, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    return null;
}

/**
 * @param array<string, mixed> $jsonBody
 * @return array{code: int, body: string}
 */
function smokeAjaxJsonPost(
    string $ajaxUrl,
    string $action,
    string $cookieFile,
    array $jsonBody,
): array {
    $url = $ajaxUrl . (str_contains($ajaxUrl, '?') ? '&' : '?') . 'action=' . rawurlencode($action);

    return smokeHttpRequest(
        $url,
        $cookieFile,
        json_encode($jsonBody, JSON_THROW_ON_ERROR),
        ['Content-Type: application/json']
    );
}

function smokeResolvePhpBinary(): string
{
    $envPhp = getenv('PHP_BIN');
    if (is_string($envPhp) && preg_match('/php(\.exe)?$/i', $envPhp)) {
        return $envPhp;
    }

    return PHP_OS_FAMILY === 'Windows' ? 'C:\\xampp\\php\\php.exe' : 'php';
}

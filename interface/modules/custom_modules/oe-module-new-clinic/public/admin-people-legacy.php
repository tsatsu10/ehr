<?php

/**
 * Host stock People / ACL admin pages in the New Clinic T1 shell (iframe).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Header;
use OpenEMR\Modules\NewClinic\Services\AdminPeopleLegacyWrapService;

$view = trim((string) ($_GET['view'] ?? ''));
$sub = trim((string) ($_GET['sub'] ?? ''));
$wrap = new AdminPeopleLegacyWrapService();

try {
    $meta = $wrap->assertViewAllowed($view);
} catch (\InvalidArgumentException) {
    http_response_code(400);
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('People admin'),
    ]);
    exit;
} catch (\RuntimeException $e) {
    $code = (int) $e->getCode();
    if ($code < 400 || $code > 599) {
        $code = 403;
    }
    http_response_code($code);
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('People admin'),
    ]);
    exit;
}

$returnSub = $sub !== '' ? $sub : (string) ($meta['sub'] ?? 'staff');
$returnUrl = AdminPeopleLegacyWrapService::adminReturnUrl($returnSub);
$iframeSrc = $wrap->buildIframeSrc($view, $_GET);
$title = (string) ($meta['title'] ?? xl('People admin'));
$isAdvanced = !empty($meta['advanced']);
$webroot = $GLOBALS['webroot'] ?? '';

?>
<!DOCTYPE html>
<html lang="<?php echo attr($_SESSION['language_direction'] ?? 'ltr'); ?>">
<head>
    <title><?php echo text($title); ?></title>
    <?php Header::setupHeader(); ?>
    <link rel="stylesheet" href="<?php echo attr($webroot); ?>/interface/modules/custom_modules/oe-module-new-clinic/public/assets/css/people-legacy-wrap.css?v=<?php echo attr(\OpenEMR\Modules\NewClinic\ModuleAssetVersion::VERSION); ?>">
</head>
<body class="nc-people-legacy-wrap">
<header class="nc-people-legacy-wrap__header">
    <nav class="nc-people-legacy-wrap__breadcrumb" aria-label="<?php echo xla('Breadcrumb'); ?>">
        <a href="<?php echo attr($returnUrl); ?>"><?php echo xlt('Clinic Setup'); ?></a>
        <span aria-hidden="true">›</span>
        <a href="<?php echo attr($returnUrl); ?>"><?php echo xlt('People & access'); ?></a>
        <span aria-hidden="true">›</span>
        <span><?php echo text($title); ?></span>
    </nav>
    <div class="nc-people-legacy-wrap__actions">
        <a class="btn btn-outline-secondary btn-sm" href="<?php echo attr($returnUrl); ?>"><?php echo xlt('Back'); ?></a>
    </div>
</header>
<?php if ($isAdvanced) { ?>
    <div class="nc-people-legacy-wrap__banner" role="status">
        <?php echo xlt('Expert mode — incorrect ACL changes can expose stock billing, EDI, or super-admin screens.'); ?>
    </div>
<?php } ?>
<iframe
    class="nc-people-legacy-wrap__frame"
    name="nc-people-legacy"
    title="<?php echo attr($title); ?>"
    src="<?php echo attr($iframeSrc); ?>"
><?php echo xlt('Loading…'); ?></iframe>
</body>
</html>

<?php

/**
 * Host the stock patient-merge tool in the New Clinic T1 shell (iframe) — GAP-D D2.
 *
 * Detection lives in the Admin Hub "Possible duplicates" card; the actual merge is
 * destructive and stays the stock tool (NG12 — no automated merge). Super-admin
 * gated, mirroring merge_patients.php's own ACL. Optional pid1/pid2 pre-select the
 * pair the admin picked in the card.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Header;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;

// Merge is a super-admin operation — refuse before rendering anything.
if (!AclMain::aclCheckCore('admin', 'super')) {
    http_response_code(403);
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('Merge patients'),
    ]);
    exit;
}

$webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');
$returnUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/admin.php?tab=system';

$pid1 = (int) ($_GET['pid1'] ?? 0);
$pid2 = (int) ($_GET['pid2'] ?? 0);
$iframeSrc = $webroot . '/interface/patient_file/merge_patients.php';
$query = [];
if ($pid1 > 0) {
    $query['pid1'] = $pid1;
}
if ($pid2 > 0) {
    $query['pid2'] = $pid2;
}
if (!empty($query)) {
    $iframeSrc .= '?' . http_build_query($query);
}
$title = xl('Merge duplicate patients');

?>
<!DOCTYPE html>
<html lang="<?php echo attr($_SESSION['language_direction'] ?? 'ltr'); ?>">
<head>
    <title><?php echo text($title); ?></title>
    <?php Header::setupHeader(); ?>
    <link rel="stylesheet" href="<?php echo attr($webroot); ?>/interface/modules/custom_modules/oe-module-new-clinic/public/assets/css/people-legacy-wrap.css?v=<?php echo attr(ModuleAssetVersion::VERSION); ?>">
</head>
<body class="nc-people-legacy-wrap">
<header class="nc-people-legacy-wrap__header">
    <nav class="nc-people-legacy-wrap__breadcrumb" aria-label="<?php echo xla('Breadcrumb'); ?>">
        <a href="<?php echo attr($returnUrl); ?>"><?php echo xlt('Clinic Setup'); ?></a>
        <span aria-hidden="true">›</span>
        <a href="<?php echo attr($returnUrl); ?>"><?php echo xlt('System'); ?></a>
        <span aria-hidden="true">›</span>
        <span><?php echo text($title); ?></span>
    </nav>
    <div class="nc-people-legacy-wrap__actions">
        <a class="btn btn-outline-secondary btn-sm" href="<?php echo attr($returnUrl); ?>"><?php echo xlt('Back'); ?></a>
    </div>
</header>
<div class="nc-people-legacy-wrap__banner" role="status">
    <?php echo xlt('Merging is permanent and cannot be undone. Confirm both records are the same person before merging.'); ?>
</div>
<iframe
    class="nc-people-legacy-wrap__frame"
    name="nc-merge-legacy"
    title="<?php echo attr($title); ?>"
    src="<?php echo attr($iframeSrc); ?>"
><?php echo xlt('Loading…'); ?></iframe>
</body>
</html>

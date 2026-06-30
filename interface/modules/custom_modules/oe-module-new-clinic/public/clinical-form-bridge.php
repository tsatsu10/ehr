<?php

/**
 * Hosts stock encounter forms in an iframe with a closeTab shim for New Clinic desks.
 *
 * Stock forms call parent.closeTab() on Save and Exit; that API exists on encounter_top
 * but not when a desk navigates directly to load_form.php.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

require_once $GLOBALS['srcdir'] . '/pid.inc.php';
require_once $GLOBALS['srcdir'] . '/encounter.inc.php';
require_once $GLOBALS['srcdir'] . '/registry.inc.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Header;
use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;

/** @var array<int, string> */
$allowedForms = ['procedure_order'];
if ((new ClinicConfigService())->isEnabled('enable_clinical_doc_hub', 0)) {
    $allowedForms = array_values(array_unique(array_merge(
        $allowedForms,
        (new ClinicalDocCatalogService())->allowedFormdirs()
    )));
}

$pid = (int) ($_GET['pid'] ?? 0);
$encounter = (int) ($_GET['encounter'] ?? 0);
$formId = (int) ($_GET['form_id'] ?? 0);
$formname = trim((string) ($_GET['formname'] ?? ''));
$returnUrl = (new ProcedureOrderDeepLinkService())->sanitizeReturnUrl((string) ($_GET['return'] ?? ''));

if ($pid <= 0 || $encounter <= 0 || $formname === '' || !in_array($formname, $allowedForms, true)) {
    http_response_code(400);
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('Clinical form'),
    ]);
    exit;
}

check_file_dir_name($formname);

if (!AclMain::aclCheckForm($formname)) {
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('Clinical form'),
    ]);
    exit;
}

try {
    (new FacilityScopeService())->assertPatientAccessible($pid);
} catch (\InvalidArgumentException) {
    echo (new TwigContainer(null, $GLOBALS['kernel']))->getTwig()->render('core/unauthorized.html.twig', [
        'pageTitle' => xl('Clinical form'),
    ]);
    exit;
}

if ($pid !== (int) ($_SESSION['pid'] ?? 0)) {
    setpid($pid);
}
if ($encounter !== (int) ($_SESSION['encounter'] ?? 0)) {
    setencounter($encounter);
}

$webroot = $GLOBALS['webroot'] ?? '';
if ($formId > 0) {
    $iframeSrc = $webroot
        . '/interface/patient_file/encounter/view_form.php?formname='
        . attr_url($formname)
        . '&id='
        . attr_url((string) $formId)
        . '&pid='
        . attr_url((string) $pid)
        . '&encounter='
        . attr_url((string) $encounter);
} else {
    $iframeSrc = $webroot
        . '/interface/patient_file/encounter/load_form.php?formname='
        . attr_url($formname)
        . '&pid='
        . attr_url((string) $pid)
        . '&encounter='
        . attr_url((string) $encounter);
}

$formTitle = xl_form_title(getRegistryEntryByDirectory($formname, 'name')['name'] ?? $formname);
if ($formTitle === '') {
    $formTitle = xl('Clinical form');
}

$identityStripHtml = '';
$stripService = new EncounterIdentityStripService();
if ($stripService->shouldRenderForCurrentRequest()) {
    $identityStripHtml = $stripService->renderHtml();
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo text($formTitle); ?></title>
    <?php Header::setupHeader(); ?>
    <script>
        <?php require $GLOBALS['srcdir'] . '/restoreSession.php'; ?>
        var webroot_url = <?php echo js_escape($webroot); ?>;
        var csrf_token_js = <?php echo js_escape(CsrfUtils::collectCsrfToken()); ?>;
        if (typeof top.webroot_url === 'undefined') {
            top.webroot_url = webroot_url;
        }

        function closeTab(winname, refresh) {
            if (typeof top.restoreSession === 'function') {
                top.restoreSession();
            }
            window.location.href = <?php echo js_escape($returnUrl); ?>;
        }
    </script>
</head>
<body class="m-0 p-0">
<?php echo $identityStripHtml; ?>
<iframe
    name="nc-clinical-form"
    class="w-100"
    style="height:100vh;border:0"
    title="<?php echo attr($formTitle); ?>"
    src="<?php echo attr($iframeSrc); ?>"
><?php echo xlt('Problem loading form.'); ?></iframe>
</body>
</html>

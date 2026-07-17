<?php

/**
 * CP-1 — native referral print page (stock print_referral.php parity).
 *
 * GET ?transid=N. Renders the site's referral_template.html via
 * ReferralPrintService and auto-opens the print dialog. Linked from the
 * chart-depth Referrals pane when `enable_native_referral_editor` is on;
 * the stock page remains the flag-OFF path.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Services\ReferralPrintService;

// ACL before any service work (audit events must never fire for a 403 —
// letter-print/rx-print precedent).
if (
    !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')
    && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth')
    && !AclMain::aclCheckCore('new_clinic', 'new_admin')
) {
    http_response_code(403);
    echo xlt('Not authorized');
    exit;
}

$transactionId = (int) ($_GET['transid'] ?? 0);
if ($transactionId <= 0) {
    http_response_code(400);
    echo xlt('Referral id is required');
    exit;
}

try {
    $html = (new ReferralPrintService())->render(
        $transactionId,
        (int) ($_SESSION['authUserID'] ?? 0)
    );
} catch (\Throwable $e) {
    http_response_code($e instanceof \RuntimeException && $e->getCode() === 404 ? 404 : 500);
    error_log('New Clinic referral-print error: ' . $e->getMessage());
    echo xlt('Referral could not be rendered');
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title><?php echo xlt('Referral Form'); ?></title>
    <style>
        body { font-family: sans-serif; margin: 1.5rem; color: #111; }
        table { border-collapse: collapse; }
        @media print { .nc-noprint { display: none; } }
    </style>
</head>
<body>
<div class="nc-noprint" style="margin-bottom:1rem">
    <button type="button" onclick="window.print()"><?php echo xlt('Print'); ?></button>
    <button type="button" onclick="window.close()"><?php echo xlt('Close'); ?></button>
</div>
<?php echo $html; ?>
<script>
    window.addEventListener('load', function () { window.print(); });
</script>
</body>
</html>

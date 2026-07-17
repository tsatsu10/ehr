<?php

/**
 * Medical certificate — letterhead print page.
 *
 * GET ?visit_id=N. Renders the visit's active certificate on clinic letterhead
 * with the serial number, a verify line, and the issuing clinician, then
 * auto-opens the print dialog. Every render increments the certificate's print
 * log (CertificateService::getPrintable). Hub-read access; reprints work
 * regardless of the visit's queue state.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Services\CertificateService;

$visitId = (int) ($_GET['visit_id'] ?? 0);
if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('Visit id is required');
    exit;
}

try {
    $data = (new CertificateService())->getPrintable($visitId);
} catch (\InvalidArgumentException $e) {
    http_response_code(400);
    echo xlt('Invalid request');
    exit;
} catch (\RuntimeException $e) {
    $code = (int) ($e->getCode() ?: 403);
    http_response_code(in_array($code, [403, 404], true) ? $code : 500);
    error_log('New Clinic certificate-print error: ' . $e->getMessage());
    echo $code === 404 ? xlt('No certificate issued on this visit yet') : xlt('Not authorized');
    exit;
} catch (\Throwable $e) {
    http_response_code(500);
    error_log('New Clinic certificate-print error: ' . $e->getMessage());
    echo xlt('Certificate could not be rendered');
    exit;
}

$cert = $data['certificate'];
$restLine = '';
if (!empty($cert['rest_from']) && !empty($cert['rest_to'])) {
    $restLine = xl('and is advised to rest from') . ' '
        . date('d/m/Y', strtotime((string) $cert['rest_from'])) . ' '
        . xl('to') . ' ' . date('d/m/Y', strtotime((string) $cert['rest_to']));
}
$dateSeen = !empty($data['date_seen']) ? date('d/m/Y', strtotime((string) $data['date_seen'])) : date('d/m/Y');
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title><?php echo xlt('Medical Certificate'); ?></title>
    <style>
        body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 2rem; color: #111; max-width: 46rem; }
        .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 0.75rem; margin-bottom: 1rem; }
        .clinic { font-size: 1.15rem; font-weight: 700; }
        .clinic-sub { font-size: 0.8rem; color: #444; margin-top: 0.15rem; }
        .doc-title { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; }
        .certno { font-size: 0.85rem; font-weight: 700; margin-top: 0.35rem; text-align: right; }
        .meta { display: flex; gap: 2rem; flex-wrap: wrap; font-size: 0.85rem; margin-bottom: 1.25rem; }
        .meta b { display: block; font-size: 0.7rem; text-transform: uppercase; color: #666; letter-spacing: 0.05em; }
        .body { font-size: 1rem; line-height: 1.7; min-height: 6rem; }
        .foot { margin-top: 3rem; display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.85rem; }
        .sig { border-top: 1px solid #111; padding-top: 0.25rem; min-width: 16rem; }
        .verify { color: #444; font-size: 0.75rem; margin-top: 1.5rem; border-top: 1px dashed #999; padding-top: 0.5rem; }
        .printed { color: #666; font-size: 0.75rem; margin-top: 0.75rem; }
        @media print { .nc-noprint { display: none; } body { margin: 0.5rem; } }
    </style>
</head>
<body>
<div class="nc-noprint" style="margin-bottom:1rem">
    <button type="button" onclick="window.print()"><?php echo xlt('Print'); ?></button>
    <button type="button" onclick="window.close()"><?php echo xlt('Close'); ?></button>
</div>

<div class="hdr">
    <div>
        <div class="clinic"><?php echo text($data['clinic_name'] !== '' ? $data['clinic_name'] : 'Clinic'); ?></div>
        <div class="clinic-sub">
            <?php echo text(trim($data['clinic_street'] . ' ' . $data['clinic_city'])); ?>
            <?php if ($data['clinic_phone'] !== '') { ?> · <?php echo text($data['clinic_phone']); ?><?php } ?>
        </div>
    </div>
    <div>
        <div class="doc-title"><?php echo xlt('Medical Certificate'); ?></div>
        <div class="certno"><?php echo text((string) $cert['cert_no']); ?></div>
    </div>
</div>

<div class="meta">
    <div><b><?php echo xlt('Patient'); ?></b><?php echo text($data['patient_name']); ?></div>
    <div><b><?php echo xlt('MRN'); ?></b><?php echo text($data['pubpid']); ?></div>
    <?php if ($data['dob'] !== '' && $data['dob'] !== '0000-00-00') { ?>
    <div><b><?php echo xlt('Date of birth'); ?></b><?php echo text(date('d/m/Y', strtotime($data['dob']))); ?></div>
    <?php } ?>
    <div><b><?php echo xlt('Type'); ?></b><?php echo text($data['type_label']); ?></div>
</div>

<div class="body">
    <p>
        <?php echo xlt('This is to certify that'); ?> <strong><?php echo text($data['patient_name']); ?></strong>
        <?php echo xlt('was seen at this clinic on'); ?> <strong><?php echo text($dateSeen); ?></strong><?php
        if ($restLine !== '') {
            echo ' ' . text($restLine);
        } ?>.
    </p>
    <?php if (!empty($cert['include_diagnosis']) && !empty($cert['diagnosis_text'])) { ?>
    <p><?php echo xlt('Diagnosis (disclosed with patient consent)'); ?>: <?php echo text((string) $cert['diagnosis_text']); ?></p>
    <?php } ?>
    <?php if (!empty($cert['remarks'])) { ?>
    <p><?php echo text((string) $cert['remarks']); ?></p>
    <?php } ?>
</div>

<div class="foot">
    <div class="sig">
        <?php echo xlt('Clinician'); ?><?php if ($data['issuer_name'] !== '') { ?>: <?php echo text($data['issuer_name']); ?><?php } ?>
    </div>
</div>

<div class="verify">
    <?php echo xlt('To verify this certificate, call the clinic and quote the certificate number above.'); ?>
</div>
<div class="printed"><?php echo xlt('Printed'); ?> <?php echo text(date('d/m/Y H:i')); ?></div>

<script>
    window.addEventListener('load', function () { window.print(); });
</script>
</body>
</html>

<?php

/**
 * Native Clinical Instructions — patient handout print page.
 *
 * GET ?visit_id=N. Renders the visit's saved clinical-instructions note as a
 * clean printable handout (clinic header, patient identity, instructions,
 * signature line) and auto-opens the print dialog. Linked from the Clinical
 * Documentation hub card and the native instructions drawer. Hub-read access;
 * printing works regardless of the visit's queue state (reprints included).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalInstructionsEditorService;

$visitId = (int) ($_GET['visit_id'] ?? 0);
if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('Visit id is required');
    exit;
}

try {
    $data = (new ClinicalInstructionsEditorService())->getPrintable($visitId);
} catch (\InvalidArgumentException $e) {
    http_response_code(400);
    echo xlt('Invalid request');
    exit;
} catch (\RuntimeException $e) {
    $code = (int) ($e->getCode() ?: 403);
    http_response_code(in_array($code, [403, 404], true) ? $code : 500);
    error_log('New Clinic instructions-print error: ' . $e->getMessage());
    echo $code === 404 ? xlt('No instructions saved on this visit yet') : xlt('Not authorized');
    exit;
} catch (\Throwable $e) {
    http_response_code(500);
    error_log('New Clinic instructions-print error: ' . $e->getMessage());
    echo xlt('Instructions could not be rendered');
    exit;
}

$printedOn = date('d/m/Y H:i');
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title><?php echo xlt('Patient Instructions'); ?></title>
    <style>
        body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 2rem; color: #111; max-width: 46rem; }
        .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 0.75rem; margin-bottom: 1rem; }
        .clinic { font-size: 1.15rem; font-weight: 700; }
        .clinic-sub { font-size: 0.8rem; color: #444; margin-top: 0.15rem; }
        .doc-title { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; }
        .meta { display: flex; gap: 2rem; flex-wrap: wrap; font-size: 0.85rem; margin-bottom: 1.25rem; }
        .meta b { display: block; font-size: 0.7rem; text-transform: uppercase; color: #666; letter-spacing: 0.05em; }
        .body { font-size: 1rem; line-height: 1.65; white-space: pre-wrap; min-height: 8rem; }
        .foot { margin-top: 3rem; display: flex; justify-content: space-between; font-size: 0.85rem; }
        .sig { border-top: 1px solid #111; padding-top: 0.25rem; min-width: 16rem; }
        .printed { color: #666; font-size: 0.75rem; margin-top: 2rem; }
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
    <div class="doc-title"><?php echo xlt('Patient Instructions'); ?></div>
</div>

<div class="meta">
    <div><b><?php echo xlt('Patient'); ?></b><?php echo text($data['patient_name']); ?></div>
    <div><b><?php echo xlt('MRN'); ?></b><?php echo text($data['pubpid']); ?></div>
    <?php if ($data['dob'] !== '' && $data['dob'] !== '0000-00-00') { ?>
    <div><b><?php echo xlt('Date of birth'); ?></b><?php echo text(date('d/m/Y', strtotime($data['dob']))); ?></div>
    <?php } ?>
    <div><b><?php echo xlt('Date'); ?></b><?php echo text(date('d/m/Y')); ?></div>
</div>

<div class="body"><?php echo text($data['instruction']); ?></div>

<div class="foot">
    <div class="sig">
        <?php echo xlt('Clinician'); ?><?php if ($data['provider_name'] !== '') { ?>: <?php echo text($data['provider_name']); ?><?php } ?>
    </div>
</div>

<div class="printed"><?php echo xlt('Printed'); ?> <?php echo text($printedOn); ?></div>

<script>
    window.addEventListener('load', function () { window.print(); });
</script>
</body>
</html>

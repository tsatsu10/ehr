<?php

/**
 * Medical certificate (New Clinic) — encounter-summary report.
 *
 * Renders the certificate number, type, rest range, and print status on the
 * stock encounter summary. Data lives in form_nc_certificate (written by the
 * module's CertificateService).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . '/../../globals.php');
require_once($GLOBALS["srcdir"] . "/api.inc.php");

function nc_certificate_report($pid, $encounter, $cols, $id): void
{
    $data = formFetch("form_nc_certificate", $id);
    if (empty($data)) {
        return;
    }

    $types = [
        'excuse_duty' => xl('Excuse duty'),
        'school_absence' => xl('School absence'),
        'fit_to_resume' => xl('Fit to resume work'),
        'attendance' => xl('Attendance only'),
    ];
    $typeLabel = $types[$data['cert_type'] ?? ''] ?? (string) ($data['cert_type'] ?? '');
    $superseded = !empty($data['superseded_by']);
    ?>
    <table style='border-collapse:collapse;border-spacing:0;width:100%;'>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='bold'><?php echo text((string) ($data['cert_no'] ?? '')); ?></span>
                — <span class='text'><?php echo text($typeLabel); ?></span>
                <?php if ($superseded) { ?>
                    <span class='text' style='color:#b00020;'>(<?php echo xlt('superseded'); ?>)</span>
                <?php } ?>
            </td>
        </tr>
        <?php if (!empty($data['rest_from']) && !empty($data['rest_to'])) { ?>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='text'><?php echo xlt('Rest advised'); ?>:
                    <?php echo text(date('d/m/Y', strtotime((string) $data['rest_from']))); ?>
                    – <?php echo text(date('d/m/Y', strtotime((string) $data['rest_to']))); ?></span>
            </td>
        </tr>
        <?php } ?>
        <?php if (!empty($data['remarks'])) { ?>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='text'><?php echo text((string) $data['remarks']); ?></span>
            </td>
        </tr>
        <?php } ?>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='text'><?php echo xlt('Printed'); ?>: <?php echo text((string) ($data['print_count'] ?? 0)); ?>×</span>
            </td>
        </tr>
    </table>
    <?php
}

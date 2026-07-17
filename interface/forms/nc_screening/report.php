<?php

/**
 * Native screening (PHQ-9 / GAD-7) encounter-form report.
 *
 * Renders the saved score, severity, and per-item answers of a native New Clinic
 * screener on the stock encounter summary. The data lives in form_nc_screening
 * (written by ScreeningAssessmentService); the instrument definition (titles,
 * option labels, max score) comes from the module's ScreeningInstrumentCatalog.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . '/../../globals.php');
require_once($GLOBALS["srcdir"] . "/api.inc.php");

use OpenEMR\Modules\NewClinic\Services\ScreeningInstrumentCatalog;

function nc_screening_report($pid, $encounter, $cols, $id): void
{
    $data = formFetch("form_nc_screening", $id);
    if (empty($data)) {
        return;
    }

    $instrument = (string) ($data['instrument'] ?? '');
    $catalog = new ScreeningInstrumentCatalog();
    $def = $catalog->getInstrument($instrument);

    $title = $def['title'] ?? strtoupper($instrument);
    $max = (int) ($def['max_score'] ?? 0);
    $total = (int) ($data['total_score'] ?? 0);
    $severity = ucwords(str_replace('_', ' ', (string) ($data['severity'] ?? '')));
    $flags = array_filter(explode(',', (string) ($data['flags'] ?? '')));
    $answers = json_decode((string) ($data['answers'] ?? '{}'), true);
    $answers = is_array($answers) ? $answers : [];

    $optionLabels = [];
    foreach (($def['options'] ?? []) as $opt) {
        $optionLabels[(int) $opt['value']] = (string) $opt['label'];
    }
    ?>
    <table style='border-collapse:collapse;border-spacing:0;width:100%;'>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='bold'><?php echo text($title); ?></span>:
                <span class='text'><?php echo text($total . ' / ' . $max . ($severity !== '' ? " ($severity)" : '')); ?></span>
            </td>
        </tr>
        <?php if (in_array('self_harm', $flags, true)) { ?>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;color:#b00020;'>
                <span class='text'><?php echo xlt('Reported thoughts of self-harm — assess safety.'); ?></span>
            </td>
        </tr>
        <?php } ?>
        <?php foreach (($def['items'] ?? []) as $index => $itemText) {
            $key = (string) ($index + 1);
            if (!array_key_exists($key, $answers)) {
                continue;
            }
            $val = (int) $answers[$key];
            ?>
        <tr>
            <td style='border:1px solid #ccc;padding:4px;'>
                <span class='text'><?php echo text(($index + 1) . '. ' . $itemText); ?></span>
                &mdash; <span class='bold'><?php echo text($optionLabels[$val] ?? (string) $val); ?></span>
            </td>
        </tr>
        <?php } ?>
    </table>
    <?php
}

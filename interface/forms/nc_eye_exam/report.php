<?php

/**
 * Primary-care eye exam (New Clinic) — encounter-summary report.
 *
 * Renders acuity per eye, pupils/IOP, findings, spectacle Rx, and impression on
 * the stock encounter summary. Data lives in form_nc_eye_exam (written by the
 * module's EyeExamService).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . '/../../globals.php');
require_once($GLOBALS["srcdir"] . "/api.inc.php");

function nc_eye_exam_report($pid, $encounter, $cols, $id): void
{
    $data = formFetch("form_nc_eye_exam", $id);
    if (empty($data)) {
        return;
    }

    $labels = [
        'injection' => xl('Red eye'), 'discharge' => xl('Discharge'),
        'corneal_opacity' => xl('Corneal opacity'), 'cataract' => xl('Cataract'),
        'pterygium' => xl('Pterygium'), 'foreign_body' => xl('Foreign body'),
        'chemosis' => xl('Chemosis'), 'hyphema' => xl('Hyphema'),
        'normal' => xl('Normal'), 'cupped_disc' => xl('Cupped disc'),
        'retinopathy' => xl('Retinopathy'), 'macular_changes' => xl('Macular changes'),
        'pale_disc' => xl('Pale disc'), 'haemorrhage' => xl('Haemorrhage'),
    ];
    $csv = static function ($value) use ($labels): string {
        if (empty($value)) {
            return '';
        }
        $out = [];
        foreach (explode(',', (string) $value) as $code) {
            $out[] = $labels[$code] ?? $code;
        }
        return implode(', ', $out);
    };

    $row = static function (string $label, string $value): void {
        if ($value === '') {
            return;
        }
        echo "<tr><td style='border:1px solid #ccc;padding:4px;'><span class='bold'>"
            . text($label) . ":</span> <span class='text'>" . text($value) . "</span></td></tr>";
    };

    $acuity = static function ($u, $p, $c): string {
        $parts = [];
        if (!empty($u)) {
            $parts[] = $u;
        }
        if (!empty($p)) {
            $parts[] = 'ph ' . $p;
        }
        if (!empty($c)) {
            $parts[] = 'cc ' . $c;
        }
        return implode(' · ', $parts);
    };
    ?>
    <table style='border-collapse:collapse;border-spacing:0;width:100%;'>
    <?php
    $row(xl('Acuity R'), $acuity($data['acuity_r_unaided'] ?? '', $data['acuity_r_pinhole'] ?? '', $data['acuity_r_corrected'] ?? ''));
    $row(xl('Acuity L'), $acuity($data['acuity_l_unaided'] ?? '', $data['acuity_l_pinhole'] ?? '', $data['acuity_l_corrected'] ?? ''));

    $pupils = empty($data['pupils_equal_reactive']) ? xl('Not equal/reactive') : xl('Equal and reactive');
    if (!empty($data['rapd_r'])) {
        $pupils .= ', ' . xl('RAPD right');
    }
    if (!empty($data['rapd_l'])) {
        $pupils .= ', ' . xl('RAPD left');
    }
    if (!empty($data['pupils_note'])) {
        $pupils .= ' — ' . $data['pupils_note'];
    }
    $row(xl('Pupils'), $pupils);

    if (!empty($data['iop_r']) || !empty($data['iop_l'])) {
        $iop = 'R ' . ($data['iop_r'] !== null ? rtrim(rtrim((string) $data['iop_r'], '0'), '.') : '—')
            . ' / L ' . ($data['iop_l'] !== null ? rtrim(rtrim((string) $data['iop_l'], '0'), '.') : '—') . ' mmHg';
        if (!empty($data['iop_method'])) {
            $iop .= ' (' . $data['iop_method'] . ')';
        }
        $row(xl('IOP'), $iop);
    }

    $row(xl('Anterior segment R'), $csv($data['antseg_r'] ?? ''));
    $row(xl('Anterior segment L'), $csv($data['antseg_l'] ?? ''));
    if (!empty($data['antseg_note'])) {
        $row(xl('Anterior segment note'), (string) $data['antseg_note']);
    }

    $fundusR = empty($data['fundus_examined_r']) ? xl('Not examined') : ($csv($data['fundus_r'] ?? '') ?: xl('Examined'));
    $fundusL = empty($data['fundus_examined_l']) ? xl('Not examined') : ($csv($data['fundus_l'] ?? '') ?: xl('Examined'));
    $row(xl('Fundus R'), $fundusR);
    $row(xl('Fundus L'), $fundusL);
    if (!empty($data['fundus_note'])) {
        $row(xl('Fundus note'), (string) $data['fundus_note']);
    }

    if (!empty($data['rx_sph_r']) || !empty($data['rx_sph_l'])) {
        $rx = 'R ' . ($data['rx_sph_r'] ?? '—') . ' / ' . ($data['rx_cyl_r'] ?? '—') . ' × ' . ($data['rx_axis_r'] ?? '—')
            . '   L ' . ($data['rx_sph_l'] ?? '—') . ' / ' . ($data['rx_cyl_l'] ?? '—') . ' × ' . ($data['rx_axis_l'] ?? '—');
        if (!empty($data['rx_add_r']) || !empty($data['rx_add_l'])) {
            $rx .= '  Add R ' . ($data['rx_add_r'] ?? '—') . ' L ' . ($data['rx_add_l'] ?? '—');
        }
        if (!empty($data['rx_pd'])) {
            $rx .= '  PD ' . $data['rx_pd'];
        }
        $row(xl('Spectacle Rx'), $rx);
    }

    $row(xl('Impression'), (string) ($data['impression'] ?? ''));
    if (!empty($data['refer'])) {
        $row(xl('Plan'), xl('Refer to eye specialist'));
    }
    ?>
    </table>
    <?php
}

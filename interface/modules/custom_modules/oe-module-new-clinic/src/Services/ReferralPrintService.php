<?php

/**
 * CP-1 — native referral print rendering (stock print_referral.php parity).
 *
 * Renders the site's own `referral_template.html` with the same placeholder
 * set the stock page substitutes ({ref_*}, {pt_*}, {to_*}, {v_*}, {label_*},
 * {insurance_*}, headers), so a clinic-customised template keeps working
 * unchanged. One deliberate improvement: the module's referral wizard stores
 * `refer_to` as free text ("Facility — Department"), which the stock page
 * renders blank (it expects a users-table id) — here a non-numeric refer_to
 * prints as the text it is.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ReferralPrintService
{
    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /**
     * Render the referral print HTML for a transaction. Throws on missing
     * template, unknown referral, or inaccessible patient.
     */
    public function render(int $transactionId, int $actorUserId): string
    {
        $templateFile = ($GLOBALS['OE_SITE_DIR'] ?? '') . '/referral_template.html';
        if (!is_file($templateFile)) {
            throw new \RuntimeException('Referral template not found', 404);
        }

        $trow = QueryUtils::querySingleRow(
            "SELECT id, pid, date FROM transactions WHERE id = ? AND title = 'LBTref' LIMIT 1",
            [$transactionId]
        );
        if (!is_array($trow)) {
            throw new \RuntimeException('Referral not found', 404);
        }

        $pid = (int) ($trow['pid'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $fields = $this->loadLbtFields($transactionId);
        $referDate = trim((string) ($fields['refer_date'] ?? ''));
        if ($referDate === '') {
            $referDate = date('Y-m-d');
        }

        $s = (string) file_get_contents($templateFile);
        $s = $this->substituteHeadersAndFacility($s, $transactionId);
        $s = $this->substituteReferralFields($s, $fields);
        $s = $this->substitutePatient($s, $pid);
        $s = $this->substituteReferTo($s, $fields);
        $s = $this->substituteVitals($s, $pid, $referDate);
        $s = $this->substituteInsurance($s, $pid);
        $s = $this->substituteLabels($s);

        // Same final pass as stock: clear any unmatched {placeholders}.
        $s = (string) preg_replace('/\{\S+\}/', '', $s);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.referral_print_native transaction_id=' . $transactionId . ' pid=' . $pid
        );

        return $s;
    }

    /**
     * @return array<string, string>
     */
    private function loadLbtFields(int $transactionId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT field_id, field_value FROM lbt_data WHERE form_id = ?',
            [$transactionId]
        ) ?: [];

        $fields = [];
        foreach ($rows as $row) {
            $fields[(string) ($row['field_id'] ?? '')] = (string) ($row['field_value'] ?? '');
        }

        return $fields;
    }

    private function substituteHeadersAndFacility(string $s, int $transactionId): string
    {
        $facility = QueryUtils::querySingleRow(
            'SELECT name, facility_npi, phone, street, city, state, postal_code FROM facility
             ORDER BY service_location DESC, billing_location DESC, id ASC LIMIT 1'
        ) ?: [];

        $name = self::esc((string) ($facility['name'] ?? ''));
        $addressBits = array_filter([
            (string) ($facility['street'] ?? ''),
            trim((string) ($facility['city'] ?? '') . ' ' . (string) ($facility['state'] ?? '')),
            (string) ($facility['phone'] ?? ''),
        ]);
        $address = self::esc(implode(' · ', $addressBits));

        $header = static fn (string $title): string =>
            '<div style="text-align:center"><strong>' . $name . '</strong>'
            . ($address !== '' ? '<br>' . $address : '')
            . '<br><span style="font-size:1.1em">' . self::esc($title) . '</span></div>';

        $s = str_replace('{header1}', $header(xl('Referral Form')), $s);
        $s = str_replace('{header2}', $header(xl('Counter Referral Form')), $s);
        $s = str_replace('{fac_name}', $name, $s);
        $s = str_replace('{fac_facility_npi}', self::esc((string) ($facility['facility_npi'] ?? '')), $s);

        return str_replace('{ref_id}', self::esc((string) $transactionId), $s);
    }

    /**
     * @param array<string, string> $fields
     */
    private function substituteReferralFields(string $s, array $fields): string
    {
        $textareas = ['body', 'reply_findings', 'reply_services', 'reply_recommend', 'reply_rx_refer'];
        $dates = ['refer_date', 'reply_date'];

        $all = [
            'refer_date', 'refer_from', 'refer_to', 'refer_diag', 'refer_risk_level', 'body',
            'reply_date', 'reply_init_diag', 'reply_final_diag', 'reply_findings',
            'reply_services', 'reply_recommend', 'reply_rx_refer',
        ];
        foreach ($all as $fieldId) {
            $value = trim((string) ($fields[$fieldId] ?? ''));
            $display = match (true) {
                $fieldId === 'refer_risk_level' => self::esc($this->listTitle('risklevel', $value)),
                $fieldId === 'refer_from' => self::esc($this->userDisplay($value)),
                $fieldId === 'refer_to' => self::esc($this->referToDisplay($value)),
                in_array($fieldId, $dates, true) => self::esc(self::displayDate($value)),
                in_array($fieldId, $textareas, true) => nl2br(self::esc($value)),
                default => self::esc($value),
            };
            $s = str_replace('{ref_' . $fieldId . '}', $display, $s);
        }

        return $s;
    }

    private function substitutePatient(string $s, int $pid): string
    {
        $pat = QueryUtils::querySingleRow(
            'SELECT title, fname, mname, lname, street, city, state, postal_code,
                    phone_home, sex, pubpid, DOB
             FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        ) ?: [];

        $dob = trim((string) ($pat['DOB'] ?? ''));
        $age = '';
        if ($dob !== '' && !str_starts_with($dob, '0000')) {
            try {
                $age = (string) (new \DateTime($dob))->diff(new \DateTime('today'))->y;
            } catch (\Exception) {
                $age = '';
            }
        }

        $s = str_replace('{ref_pid}', self::esc((string) $pid), $s);
        $s = str_replace('{pt_age}', self::esc($age), $s);
        $s = str_replace('{pt_DOB}', self::esc(self::displayDate($dob)), $s);
        $s = str_replace('{pt_sex}', self::esc($this->listTitle('sex', (string) ($pat['sex'] ?? ''))), $s);

        foreach (['title', 'fname', 'mname', 'lname', 'street', 'city', 'state', 'postal_code', 'phone_home', 'pubpid'] as $key) {
            $s = str_replace('{pt_' . $key . '}', self::esc((string) ($pat[$key] ?? '')), $s);
        }

        return $s;
    }

    /**
     * @param array<string, string> $fields
     */
    private function substituteReferTo(string $s, array $fields): string
    {
        $to = ['organization' => '', 'street' => '', 'city' => '', 'state' => '', 'zip' => '', 'phone' => ''];
        $referTo = trim((string) ($fields['refer_to'] ?? ''));
        if ($referTo !== '' && ctype_digit($referTo)) {
            $row = QueryUtils::querySingleRow(
                'SELECT organization, street, city, state, zip, phone FROM users WHERE id = ? LIMIT 1',
                [(int) $referTo]
            );
            if (is_array($row)) {
                $to = array_merge($to, array_map('strval', $row));
            }
        } elseif ($referTo !== '') {
            // Wizard free-text destination — print it where the organization goes.
            $to['organization'] = $referTo;
        }

        foreach ($to as $key => $value) {
            $s = str_replace('{to_' . $key . '}', self::esc($value), $s);
        }

        return $s;
    }

    private function substituteVitals(string $s, int $pid, string $referDate): string
    {
        $vrow = QueryUtils::querySingleRow(
            'SELECT bps, bpd, weight, height FROM form_vitals
             WHERE pid = ? AND date <= ?
             ORDER BY date DESC LIMIT 1',
            [$pid, $referDate . ' 23:59:59']
        ) ?: [];

        foreach (['bps', 'bpd', 'weight', 'height'] as $key) {
            $s = str_replace('{v_' . $key . '}', self::esc((string) ($vrow[$key] ?? '')), $s);
        }

        return $s;
    }

    private function substituteInsurance(string $s, int $pid): string
    {
        $ins = QueryUtils::querySingleRow(
            "SELECT ic.name AS provider_name, i.plan_name, i.policy_number, i.group_number, i.date
             FROM insurance_data i
             LEFT JOIN insurance_companies ic ON ic.id = i.provider
             WHERE i.pid = ? AND i.type = 'primary'
             ORDER BY i.date DESC LIMIT 1",
            [$pid]
        ) ?: [];

        foreach (['provider_name', 'plan_name', 'policy_number', 'group_number', 'date'] as $key) {
            $s = str_replace('{insurance_' . $key . '}', self::esc((string) ($ins[$key] ?? '')), $s);
        }

        return $s;
    }

    private function substituteLabels(string $s): string
    {
        $labels = [
            'label_clinic_id' => xl('Clinic ID'),
            'label_client_id' => xl('Client ID'),
            'label_control_no' => xl('Control No.'),
            'label_date' => xl('Date'),
            'label_webpage_title' => xl('Referral Form'),
            'label_form1_title' => xl('Referral Form'),
            'label_name' => xl('Name'),
            'label_dob' => xl('DOB'),
            'label_age' => xl('Age'),
            'label_gender' => xl('Gender'),
            'label_address' => xl('Address'),
            'label_postal' => xl('Postal'),
            'label_phone' => xl('Phone'),
            'label_ref_reason' => xl('Reference Reason'),
            'label_diagnosis' => xl('Diagnosis'),
            'label_ref_class' => xl('Reference classification (risk level)'),
            'label_dr_name_sig' => xl("Doctor's name and signature"),
            'label_refer_to' => xl('Referred to'),
            'label_clinic' => xl('Health centre/clinic'),
            'label_history_summary' => xl('Client medical history summary'),
            'label_bp' => xl('Blood pressure'),
            'label_ht' => xl('Height'),
            'label_wt' => xl('Weight'),
            'label_ref_name_sig' => xl('Referer name and signature'),
            'label_special_name_sig' => xl('Specialist name and signature'),
            'label_form2_title' => xl('Counter Referral Form'),
            'label_findings' => xl('Findings'),
            'label_final_diagnosis' => xl('Final Diagnosis'),
            'label_services_provided' => xl('Services provided'),
            'label_recommendations' => xl('Recommendations and treatment'),
            'label_scripts_and_referrals' => xl('Prescriptions and other referrals'),
            'label_subhead_clinic' => xl('Clinic Copy'),
            'label_subhead_patient' => xl('Client Copy'),
            'label_subhead_referred' => xl('Referred-to Copy'),
            'label_ins_name' => xl('Insurance'),
            'label_ins_plan_name' => xl('Plan'),
            'label_ins_policy' => xl('Policy'),
            'label_ins_group' => xl('Group'),
            'label_ins_date' => xl('Effective Date'),
        ];

        foreach ($labels as $key => $value) {
            $s = str_replace('{' . $key . '}', self::esc($value), $s);
        }

        return $s;
    }

    private function listTitle(string $listId, string $optionId): string
    {
        if ($optionId === '') {
            return '';
        }
        $row = QueryUtils::querySingleRow(
            'SELECT title FROM list_options WHERE list_id = ? AND option_id = ? LIMIT 1',
            [$listId, $optionId]
        );

        return is_array($row) ? (string) ($row['title'] ?? $optionId) : $optionId;
    }

    private function userDisplay(string $userId): string
    {
        if ($userId === '' || !ctype_digit($userId) || (int) $userId <= 0) {
            return '';
        }
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM users WHERE id = ? LIMIT 1',
            [(int) $userId]
        );

        return is_array($row)
            ? trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? ''))
            : '';
    }

    private function referToDisplay(string $referTo): string
    {
        if ($referTo === '') {
            return '';
        }
        if (ctype_digit($referTo)) {
            $row = QueryUtils::querySingleRow(
                'SELECT organization, fname, lname FROM users WHERE id = ? LIMIT 1',
                [(int) $referTo]
            );
            if (is_array($row)) {
                $org = trim((string) ($row['organization'] ?? ''));
                if ($org !== '') {
                    return $org;
                }

                return trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? ''));
            }
        }

        return $referTo;
    }

    /** DD/MM/YYYY for the regional display convention; blank-safe. */
    public static function displayDate(string $date): string
    {
        $date = trim($date);
        if ($date === '' || str_starts_with($date, '0000')) {
            return '';
        }
        $parsed = \DateTime::createFromFormat('Y-m-d', substr($date, 0, 10));

        return $parsed ? $parsed->format('d/m/Y') : $date;
    }

    private static function esc(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES);
    }
}

<?php

/**
 * Level-1 Quick Add patient create (M1b)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\PatientService;

class QuickAddService
{
    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PatientDuplicateService $duplicateService = new PatientDuplicateService(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
    ) {
    }

    /**
     * @return array{pid: int, pubpid: string, completion_score: int}
     */
    public function create(array $input, int $actorUserId): array
    {
        $fname = trim((string) ($input['fname'] ?? ''));
        $lname = trim((string) ($input['lname'] ?? ''));
        $sex = $this->normalizeSex((string) ($input['sex'] ?? ''));
        $phone = trim((string) ($input['phone'] ?? ''));
        $dob = trim((string) ($input['DOB'] ?? ''));
        $ageYears = isset($input['age_years']) ? (int) $input['age_years'] : null;
        $dobEstimated = 0;
        $noPhoneReason = trim((string) ($input['no_phone_reason'] ?? ''));
        $dupOverride = !empty($input['dup_override']);
        $dupOverrideReason = trim((string) ($input['dup_override_reason'] ?? ''));

        if ($fname === '' || strlen($lname) < 2 || $sex === '') {
            throw new \InvalidArgumentException('First name, last name (min 2 chars), and sex are required');
        }

        if ($dob === '' && ($ageYears === null || $ageYears < 0)) {
            throw new \InvalidArgumentException('Date of birth or estimated age is required');
        }

        if ($dob === '' && $ageYears !== null) {
            $year = (int) date('Y') - $ageYears;
            $dob = sprintf('%04d-07-01', $year);
            $dobEstimated = 1;
        }

        $normalizedPhone = $this->phoneNormalizer->normalize($phone);

        if ($normalizedPhone !== '') {
            $pattern = $this->config->get('phone_validation_regex', '^0[235]\d{8}$') ?? '^0[235]\d{8}$';
            if (!preg_match('/' . $pattern . '/', $normalizedPhone)) {
                throw new \InvalidArgumentException('Phone format is invalid');
            }
        }

        $dup = $this->duplicateService->scoreProspect([
            'fname' => $fname,
            'lname' => $lname,
            'sex' => $sex,
            'DOB' => $dob,
            'phone' => $normalizedPhone,
        ]);

        if ($dup['level'] === 'block' && !$dupOverride) {
            throw new \InvalidArgumentException('Likely duplicate patient — use existing record or override');
        }

        if ($dup['level'] === 'warn' && empty($input['dup_confirm'])) {
            throw new \InvalidArgumentException('Confirm this is a different patient');
        }

        if ($dup['level'] === 'block' && $dupOverride) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_create_despite_dup')) {
                throw new \InvalidArgumentException('Duplicate override not permitted for this user');
            }
            if ($dupOverrideReason === '') {
                throw new \InvalidArgumentException('Duplicate override reason is required');
            }
        }

        $patientData = [
            'fname' => $fname,
            'lname' => $lname,
            'sex' => $sex,
            'DOB' => $dob,
            'phone_cell' => $normalizedPhone !== '' ? $normalizedPhone : '',
        ];

        $patientService = new PatientService();
        $result = $patientService->insert($patientData);
        if (!$result->isValid() || !$result->hasData()) {
            $messages = $result->getValidationMessages();
            throw new \InvalidArgumentException('Could not create patient: ' . json_encode($messages));
        }

        $pid = (int) $result->getFirstDataResult()['pid'];

        if ($normalizedPhone !== '') {
            QueryUtils::sqlInsert(
                "UPDATE patient_data SET phone_normalized = ? WHERE pid = ?",
                [$normalizedPhone, $pid]
            );
        }

        require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
        updateDupScore($pid);

        QueryUtils::sqlInsert(
            "INSERT INTO new_patient_meta (pid, dob_estimated, no_phone_reason)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                dob_estimated = VALUES(dob_estimated),
                no_phone_reason = VALUES(no_phone_reason),
                updated_at = NOW()",
            [$pid, $dobEstimated, $noPhoneReason !== '' ? $noPhoneReason : null]
        );

        $completionResult = $this->completionService->recompute($pid);

        if ($dupOverride) {
            EventAuditLogger::getInstance()->newEvent(
                'new_patient',
                $_SESSION['authUser'] ?? 'system',
                $_SESSION['authProvider'] ?? 'default',
                'dup_override',
                json_encode([
                    'pid' => $pid,
                    'candidates' => $dup['candidates'],
                    'reason' => $dupOverrideReason,
                    'actor_user_id' => $actorUserId,
                ]),
                $pid
            );
        }

        $row = QueryUtils::querySingleRow("SELECT pubpid FROM patient_data WHERE pid = ?", [$pid]);

        return [
            'pid' => $pid,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'completion_score' => (int) ($completionResult['score'] ?? 0),
            'dob_estimated' => $dobEstimated === 1,
        ];
    }

    private function normalizeSex(string $sex): string
    {
        $map = [
            'M' => 'Male',
            'F' => 'Female',
            'O' => 'UNK',
            'Male' => 'Male',
            'Female' => 'Female',
            'Other' => 'UNK',
            'UNK' => 'UNK',
        ];

        return $map[$sex] ?? '';
    }
}

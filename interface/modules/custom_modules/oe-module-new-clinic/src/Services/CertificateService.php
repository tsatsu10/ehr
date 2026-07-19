<?php

/**
 * Medical certificate (excuse duty / school note) — native editor service.
 *
 * Backs the "Medical certificate" card on the Clinical Documentation This-visit
 * lens (flag `enable_native_certificate`, default OFF). Replaces the stock
 * Work/School Note idea with an auditable document: a unique serial number
 * (MC-YYYY-NNNNN, derived from the row id — race-free and phone-verifiable),
 * the issuing clinician taken from the session identity (never typed),
 * diagnosis included only with an explicit consent flag, and print logging.
 *
 * Edit rules: a certificate is editable until its first print; after printing,
 * changes issue a NEW certificate (new number) and mark the old one superseded —
 * a printed document must never silently change. E-sign lock applies like the
 * other native editors. Lazy construction only (crash-pattern rule).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\FormService;

class CertificateService
{
    private const FORMDIR = 'nc_certificate';
    private const FORM_TITLE = 'Medical certificate';

    public const TYPES = [
        'excuse_duty' => 'Excuse duty',
        'school_absence' => 'School absence',
        'fit_to_resume' => 'Fit to resume work',
        'attendance' => 'Attendance only',
    ];

    /** Types that carry a rest-date range. */
    private const TYPES_WITH_REST = ['excuse_duty', 'school_absence'];

    /** States in which a clinician may issue a certificate. */
    private const CLINICAL_STATES = [
        'awaiting_triage', 'in_triage', 'with_doctor',
        'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
    ];

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
    ) {
    }

    /**
     * Bootstrap payload: type catalog + the latest active certificate (if any).
     *
     * @return array<string, mixed>
     */
    public function getCertificate(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $this->assertEnabled((int) ($visit['facility_id'] ?? 0));
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatestActive($pid, $encounter);

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'types' => self::TYPES,
            'certificate' => $existing,
            'locked' => $this->isSigned($encounter, $pid),
        ];
    }

    /**
     * Issue or amend the visit's certificate.
     *
     * Unprinted certificate -> updated in place (same number). Printed
     * certificate -> a NEW certificate is issued and the old one superseded.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveCertificate(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visitId = (int) ($body['visit_id'] ?? 0);
        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $this->assertEnabled((int) ($visit['facility_id'] ?? 0));
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter yet');
        }
        if ($this->isSigned($encounter, $pid)) {
            throw new \RuntimeException('This certificate is signed — unlock the encounter to amend it', 409);
        }

        $type = strtolower(trim((string) ($body['cert_type'] ?? '')));
        if (!isset(self::TYPES[$type])) {
            throw new \InvalidArgumentException('Choose a certificate type');
        }

        $restFrom = $this->normaliseDate($body['rest_from'] ?? null);
        $restTo = $this->normaliseDate($body['rest_to'] ?? null);
        if (in_array($type, self::TYPES_WITH_REST, true)) {
            if ($restFrom === null || $restTo === null) {
                throw new \InvalidArgumentException('Rest dates are required for this certificate type');
            }
            if ($restTo < $restFrom) {
                throw new \InvalidArgumentException('Rest end date must not be before the start date');
            }
        } else {
            $restFrom = null;
            $restTo = null;
        }

        $remarks = mb_substr(trim((string) ($body['remarks'] ?? '')), 0, 500);
        $includeDiagnosis = !empty($body['include_diagnosis']) ? 1 : 0;
        $diagnosisText = $includeDiagnosis === 1
            ? mb_substr(trim((string) ($body['diagnosis_text'] ?? '')), 0, 500)
            : '';

        $existing = $this->loadLatestActive($pid, $encounter);

        if ($existing !== null && (int) $existing['print_count'] === 0) {
            // Editable until first print — update in place, same number.
            QueryUtils::sqlStatementThrowException(
                'UPDATE form_nc_certificate
                 SET cert_type = ?, rest_from = ?, rest_to = ?, remarks = ?,
                     include_diagnosis = ?, diagnosis_text = ?, date = NOW(), user = ?
                 WHERE id = ?',
                [
                    $type, $restFrom, $restTo, $remarks,
                    $includeDiagnosis, $diagnosisText,
                    $_SESSION['authUser'] ?? '', (int) $existing['id'],
                ]
            );
            QueryUtils::sqlStatementThrowException(
                'UPDATE forms SET date = NOW() WHERE form_id = ? AND encounter = ? AND pid = ? AND formdir = ?',
                [(int) $existing['id'], $encounter, $pid, self::FORMDIR]
            );

            return $this->loadLatestActive($pid, $encounter) + [
                'saved' => true,
                'superseded' => false,
                'charge' => $this->postCharge($visit, $actorUserId),
            ];
        }

        // First certificate, or amending a printed one -> new row + number.
        $newId = (int) QueryUtils::sqlInsert(
            'INSERT INTO form_nc_certificate
                (date, pid, encounter, user, authorized, activity, cert_no, cert_type,
                 rest_from, rest_to, remarks, include_diagnosis, diagnosis_text, issued_by_user_id)
             VALUES (NOW(), ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $pid, $encounter, $_SESSION['authUser'] ?? '',
                // Unique placeholder: cert_no carries a UNIQUE index, so two
                // concurrent issues must not both insert the same interim value.
                'PENDING-' . uniqid('', true),
                $type, $restFrom, $restTo, $remarks,
                $includeDiagnosis, $diagnosisText, $actorUserId,
            ]
        );
        // Serial derived from the unique row id: race-free, monotonic,
        // phone-verifiable. Format MC-YYYY-NNNNN.
        $certNo = sprintf('MC-%s-%05d', date('Y'), $newId);
        QueryUtils::sqlStatementThrowException(
            'UPDATE form_nc_certificate SET cert_no = ? WHERE id = ?',
            [$certNo, $newId]
        );
        (new FormService())->addForm($encounter, self::FORM_TITLE, $newId, self::FORMDIR, $pid, '1');

        $superseded = false;
        if ($existing !== null) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE form_nc_certificate SET superseded_by = ?, activity = 0 WHERE id = ?',
                [$newId, (int) $existing['id']]
            );
            $superseded = true;
        }

        return $this->loadLatestActive($pid, $encounter) + [
            'saved' => true,
            'superseded' => $superseded,
            'charge' => $this->postCharge($visit, $actorUserId),
        ];
    }

    /**
     * Certificate fee (Clinic Setup `certificate_auto_bill`). Idempotent per
     * encounter, so update-in-place and supersede never double-charge; a
     * failure to bill must never lose the saved certificate.
     *
     * @param array<string, mixed> $visit
     * @return array<string, mixed>|null
     */
    private function postCharge(array $visit, int $actorUserId): ?array
    {
        try {
            return (new CertificateChargeService())->postCertificateCharge(
                (int) ($visit['pid'] ?? 0),
                (int) ($visit['encounter'] ?? 0),
                $actorUserId,
                (int) ($visit['facility_id'] ?? 0),
                $actorUserId
            );
        } catch (\Throwable $e) {
            error_log('New Clinic certificate charge failed: ' . $e->getMessage());

            return null;
        }
    }

    /**
     * Verify a certificate by its serial number (the "call the clinic and quote
     * the number" flow — reception checks a paper someone presents).
     *
     * Returns enough to compare against the paper: patient, type, dates,
     * clinician, and whether a newer certificate superseded it. ACL enforced by
     * the ajax policy (reception/doctor/admin); facility-scope misses read as
     * "not found" so cross-facility probing leaks nothing.
     *
     * @return array<string, mixed>
     */
    public function verifyBySerial(string $serial): array
    {
        $serial = strtoupper(preg_replace('/\s+/', '', $serial) ?? '');
        if ($serial === '' || !preg_match('/^MC-\d{4}-\d{1,10}$/', $serial)) {
            throw new \InvalidArgumentException('Enter a certificate number like MC-2026-00042');
        }

        $cert = QueryUtils::querySingleRow(
            'SELECT c.*, p.fname, p.lname, p.pubpid
             FROM form_nc_certificate c
             JOIN patient_data p ON p.pid = c.pid
             WHERE c.cert_no = ? LIMIT 1',
            [$serial]
        );
        if (!is_array($cert)) {
            return ['found' => false, 'cert_no' => $serial];
        }

        try {
            (new FacilityScopeService())->assertPatientAccessible((int) $cert['pid']);
        } catch (\Throwable) {
            return ['found' => false, 'cert_no' => $serial];
        }

        $issuer = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM users WHERE id = ?',
            [(int) ($cert['issued_by_user_id'] ?? 0)]
        ) ?: [];

        // Verification reads patient identity by serial — audit like other PHI reads.
        \OpenEMR\Common\Logging\EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'front_desk.certificate_verified',
            (int) ($_SESSION['authUserID'] ?? 0),
            1,
            'cert_no=' . $serial . ' pid=' . (int) $cert['pid']
        );

        $supersededByNo = null;
        if (!empty($cert['superseded_by'])) {
            $newer = QueryUtils::querySingleRow(
                'SELECT cert_no FROM form_nc_certificate WHERE id = ? LIMIT 1',
                [(int) $cert['superseded_by']]
            );
            $supersededByNo = is_array($newer) ? (string) ($newer['cert_no'] ?? '') : null;
        }

        return [
            'found' => true,
            'cert_no' => (string) $cert['cert_no'],
            'status' => ((int) ($cert['activity'] ?? 0)) === 1 ? 'valid' : 'superseded',
            'superseded_by_no' => $supersededByNo,
            'cert_type' => self::TYPES[(string) ($cert['cert_type'] ?? '')] ?? (string) ($cert['cert_type'] ?? ''),
            'issued_on' => !empty($cert['date']) ? date('d/m/Y', strtotime((string) $cert['date'])) : '',
            'rest_from' => !empty($cert['rest_from']) ? date('d/m/Y', strtotime((string) $cert['rest_from'])) : null,
            'rest_to' => !empty($cert['rest_to']) ? date('d/m/Y', strtotime((string) $cert['rest_to'])) : null,
            'patient_name' => trim(((string) ($cert['fname'] ?? '')) . ' ' . ((string) ($cert['lname'] ?? ''))),
            'pubpid' => (string) ($cert['pubpid'] ?? ''),
            'clinician' => trim(((string) ($issuer['fname'] ?? '')) . ' ' . ((string) ($issuer['lname'] ?? ''))),
            'ever_printed' => ((int) ($cert['print_count'] ?? 0)) > 0,
        ];
    }

    /**
     * Printable payload; increments the print log. Hub-read access and NO
     * clinical-state guard — reprints must work after the visit moves on.
     *
     * @return array<string, mixed>
     */
    public function getPrintable(int $visitId): array
    {
        $this->access->assertHubAccess();

        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }
        $visit = $this->queueService->getVisitForActor($visitId);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);

        $cert = $this->loadLatestActive($pid, $encounter);
        if ($cert === null) {
            throw new \RuntimeException('No certificate issued on this visit yet', 404);
        }

        QueryUtils::sqlStatementThrowException(
            'UPDATE form_nc_certificate SET print_count = print_count + 1, last_printed_at = NOW() WHERE id = ?',
            [(int) $cert['id']]
        );

        $patient = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid, DOB FROM patient_data WHERE pid = ?',
            [$pid]
        ) ?: [];

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $facility = $facilityId > 0
            ? (QueryUtils::querySingleRow(
                'SELECT name, street, city, phone FROM facility WHERE id = ?',
                [$facilityId]
            ) ?: [])
            : [];

        $issuer = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM users WHERE id = ?',
            [(int) $cert['issued_by_user_id']]
        ) ?: [];

        return [
            'certificate' => $cert,
            'type_label' => self::TYPES[$cert['cert_type']] ?? $cert['cert_type'],
            'patient_name' => trim(((string) ($patient['fname'] ?? '')) . ' ' . ((string) ($patient['lname'] ?? ''))),
            'pubpid' => (string) ($patient['pubpid'] ?? $pid),
            'dob' => (string) ($patient['DOB'] ?? ''),
            'clinic_name' => (string) ($facility['name'] ?? ''),
            'clinic_street' => (string) ($facility['street'] ?? ''),
            'clinic_city' => (string) ($facility['city'] ?? ''),
            'clinic_phone' => (string) ($facility['phone'] ?? ''),
            'issuer_name' => trim(((string) ($issuer['fname'] ?? '')) . ' ' . ((string) ($issuer['lname'] ?? ''))),
            'date_seen' => (string) ($cert['date'] ?? ''),
        ];
    }

    /**
     * Latest active (non-superseded) certificate on the encounter.
     *
     * @return array<string, mixed>|null
     */
    private function loadLatestActive(int $pid, int $encounter): ?array
    {
        if ($encounter <= 0) {
            return null;
        }

        $row = QueryUtils::fetchRecords(
            "SELECT c.id, c.cert_no, c.cert_type, c.rest_from, c.rest_to, c.remarks,
                    c.include_diagnosis, c.diagnosis_text, c.issued_by_user_id,
                    c.print_count, c.last_printed_at, c.date
             FROM forms f
             JOIN form_nc_certificate c ON c.id = f.form_id
             WHERE f.encounter = ? AND f.pid = ? AND f.formdir = ? AND f.deleted = 0
               AND c.activity = 1 AND c.superseded_by IS NULL
             ORDER BY c.id DESC
             LIMIT 1",
            [$encounter, $pid, self::FORMDIR]
        );

        if (empty($row[0])) {
            return null;
        }

        $cert = $row[0];
        $cert['id'] = (int) $cert['id'];
        $cert['print_count'] = (int) $cert['print_count'];
        $cert['include_diagnosis'] = (int) $cert['include_diagnosis'];

        return $cert;
    }

    private function normaliseDate(mixed $raw): ?string
    {
        $value = trim((string) ($raw ?? ''));
        if ($value === '') {
            return null;
        }
        $ts = strtotime($value);
        if ($ts === false) {
            throw new \InvalidArgumentException('Invalid date');
        }

        return date('Y-m-d', $ts);
    }

    private function assertEnabled(int $facilityId): void
    {
        if (!$this->config->isEnabled('enable_native_certificate', 0, $facilityId)) {
            throw new \RuntimeException('Medical certificates are not enabled', 403);
        }
    }

    /** Instantiated at call time (not in the constructor) — crash-pattern rule. */
    private function isSigned(int $encounter, int $pid): bool
    {
        if ($encounter <= 0) {
            return false;
        }

        return (new EncounterSignService())->isFormdirSignedOnEncounter($encounter, $pid, self::FORMDIR);
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveClinicalVisit(int $visitId, int $actorUserId): array
    {
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        if (!in_array($state, self::CLINICAL_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }
        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        return $visit;
    }
}

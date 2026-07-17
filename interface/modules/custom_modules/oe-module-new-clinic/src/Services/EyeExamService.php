<?php

/**
 * Primary-care eye exam — native editor service.
 *
 * Backs the "Eye exam" card on the Clinical Documentation Specialty lens
 * (flag `enable_native_eye_exam`, default OFF). The WHO-primary-care level
 * exam a GP or visiting optometrist actually performs — visual acuity in 6/x
 * metric notation (with CF/HM/PL low-vision values), pupils/RAPD, optional IOP,
 * anterior-segment and fundus quick-pick findings with "not examined" recorded
 * honestly, an optional spectacle prescription, and a refer flag — NOT the
 * stock 16-table `eye_mag` subspecialty suite (which stays disabled).
 *
 * Storage: module table `form_nc_eye_exam`, one row per exam, edit-in-place of
 * the latest set per encounter (vitals precedent). Field/option definitions are
 * server-owned (single source of truth for the drawer). E-sign lock applies.
 * Lazy construction only (crash-pattern rule).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\FormService;

class EyeExamService
{
    private const FORMDIR = 'nc_eye_exam';
    private const FORM_TITLE = 'Eye exam';

    /** 6/x metric notation + low-vision values (regional standard; never 20/20). */
    public const ACUITY_VALUES = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'CF', 'HM', 'PL', 'NPL'];

    public const ANTSEG_FINDINGS = [
        'normal' => 'Normal',
        'injection' => 'Red eye / injection',
        'discharge' => 'Discharge',
        'corneal_opacity' => 'Corneal opacity',
        'cataract' => 'Cataract',
        'pterygium' => 'Pterygium',
        'foreign_body' => 'Foreign body',
        'chemosis' => 'Chemosis',
        'hyphema' => 'Hyphema',
    ];

    public const FUNDUS_FINDINGS = [
        'normal' => 'Normal',
        'cupped_disc' => 'Cupped disc',
        'retinopathy' => 'Retinopathy',
        'macular_changes' => 'Macular changes',
        'pale_disc' => 'Pale disc',
        'haemorrhage' => 'Haemorrhage',
    ];

    public const IOP_METHODS = [
        'icare' => 'iCare',
        'applanation' => 'Applanation',
        'tonopen' => 'Tono-Pen',
        'schiotz' => 'Schiøtz',
        'digital' => 'Digital (finger)',
    ];

    /** Free-text / numeric columns saved verbatim after bounds checks. */
    private const ACUITY_FIELDS = [
        'acuity_r_unaided', 'acuity_l_unaided', 'acuity_r_pinhole',
        'acuity_l_pinhole', 'acuity_r_corrected', 'acuity_l_corrected',
    ];

    private const RX_FIELDS = [
        'rx_sph_r', 'rx_sph_l', 'rx_cyl_r', 'rx_cyl_l', 'rx_add_r', 'rx_add_l', 'rx_pd',
    ];

    /** States in which a clinician may record an exam. */
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
     * Bootstrap payload: option catalogs + the latest exam on the encounter.
     *
     * @return array<string, mixed>
     */
    public function getExam(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $this->assertEnabled((int) ($visit['facility_id'] ?? 0));
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatest($pid, $encounter);

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'exam_id' => $existing['id'] ?? null,
            'values' => $existing['values'] ?? new \stdClass(),
            'saved' => $existing !== null,
            'locked' => $this->isSigned($encounter, $pid),
            'meta' => [
                'acuity_values' => self::ACUITY_VALUES,
                'antseg_findings' => self::ANTSEG_FINDINGS,
                'fundus_findings' => self::FUNDUS_FINDINGS,
                'iop_methods' => self::IOP_METHODS,
            ],
        ];
    }

    /**
     * Save the encounter's exam: update the latest in place, or create one.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveExam(array $body, int $actorUserId): array
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
            throw new \RuntimeException('This eye exam is signed — unlock the encounter to amend it', 409);
        }

        $raw = is_array($body['values'] ?? null) ? $body['values'] : [];
        $payload = $this->validate($raw);

        $existing = $this->loadLatest($pid, $encounter);
        if ($existing !== null) {
            $sets = [];
            $binds = [];
            foreach ($payload as $col => $val) {
                $sets[] = "`$col` = ?";
                $binds[] = $val;
            }
            $binds[] = $_SESSION['authUser'] ?? '';
            $binds[] = (int) $existing['id'];
            QueryUtils::sqlStatementThrowException(
                'UPDATE form_nc_eye_exam SET ' . implode(', ', $sets) . ', date = NOW(), user = ? WHERE id = ?',
                $binds
            );
            QueryUtils::sqlStatementThrowException(
                'UPDATE forms SET date = NOW() WHERE form_id = ? AND encounter = ? AND pid = ? AND formdir = ?',
                [(int) $existing['id'], $encounter, $pid, self::FORMDIR]
            );
            $examId = (int) $existing['id'];
        } else {
            $cols = array_keys($payload);
            $colSql = implode(', ', array_map(static fn (string $c): string => "`$c`", $cols));
            $examId = (int) QueryUtils::sqlInsert(
                "INSERT INTO form_nc_eye_exam (date, pid, encounter, user, $colSql, authorized, activity)
                 VALUES (NOW(), ?, ?, ?, " . implode(', ', array_fill(0, count($cols), '?')) . ', 1, 1)',
                array_merge([$pid, $encounter, $_SESSION['authUser'] ?? ''], array_values($payload))
            );
            (new FormService())->addForm($encounter, self::FORM_TITLE, $examId, self::FORMDIR, $pid, '1');
        }

        return [
            'saved' => true,
            'exam_id' => $examId,
            'refer' => (int) ($payload['refer'] ?? 0) === 1,
        ];
    }

    /**
     * Whitelist + bounds-check the client values into a column payload.
     *
     * @param array<string, mixed> $raw
     * @return array<string, mixed>
     */
    private function validate(array $raw): array
    {
        $payload = [];

        foreach (self::ACUITY_FIELDS as $field) {
            $value = trim((string) ($raw[$field] ?? ''));
            if ($value === '') {
                $payload[$field] = null;
                continue;
            }
            if (!in_array($value, self::ACUITY_VALUES, true)) {
                throw new \InvalidArgumentException('Invalid visual acuity value');
            }
            $payload[$field] = $value;
        }

        $payload['pupils_equal_reactive'] = !empty($raw['pupils_equal_reactive']) ? 1 : 0;
        $payload['rapd_r'] = !empty($raw['rapd_r']) ? 1 : 0;
        $payload['rapd_l'] = !empty($raw['rapd_l']) ? 1 : 0;
        $payload['pupils_note'] = mb_substr(trim((string) ($raw['pupils_note'] ?? '')), 0, 255) ?: null;

        foreach (['iop_r', 'iop_l'] as $field) {
            $value = trim((string) ($raw[$field] ?? ''));
            if ($value === '') {
                $payload[$field] = null;
                continue;
            }
            if (!is_numeric($value) || (float) $value < 0 || (float) $value > 80) {
                throw new \InvalidArgumentException('Eye pressure must be between 0 and 80 mmHg');
            }
            $payload[$field] = round((float) $value, 1);
        }
        $method = trim((string) ($raw['iop_method'] ?? ''));
        $payload['iop_method'] = isset(self::IOP_METHODS[$method]) ? $method : null;

        foreach (['antseg_r', 'antseg_l'] as $field) {
            $payload[$field] = $this->cleanFindings($raw[$field] ?? [], self::ANTSEG_FINDINGS);
        }
        $payload['antseg_note'] = mb_substr(trim((string) ($raw['antseg_note'] ?? '')), 0, 500) ?: null;

        $payload['fundus_examined_r'] = !empty($raw['fundus_examined_r']) ? 1 : 0;
        $payload['fundus_examined_l'] = !empty($raw['fundus_examined_l']) ? 1 : 0;
        foreach (['fundus_r' => 'fundus_examined_r', 'fundus_l' => 'fundus_examined_l'] as $field => $examinedFlag) {
            // An unexamined eye must not carry findings — "not examined" is
            // honest data, stale picked findings would contradict it.
            $payload[$field] = $payload[$examinedFlag] === 1
                ? $this->cleanFindings($raw[$field] ?? [], self::FUNDUS_FINDINGS)
                : null;
        }
        $payload['fundus_note'] = mb_substr(trim((string) ($raw['fundus_note'] ?? '')), 0, 500) ?: null;

        foreach (self::RX_FIELDS as $field) {
            $value = trim((string) ($raw[$field] ?? ''));
            if ($value === '') {
                $payload[$field] = null;
                continue;
            }
            if ($field === 'rx_pd') {
                if (!is_numeric($value) || (float) $value < 40 || (float) $value > 85) {
                    throw new \InvalidArgumentException('PD must be between 40 and 85 mm');
                }
                $payload[$field] = $value;
                continue;
            }
            // Sphere / cylinder / add: signed dioptres like -2.25, +1.5, 0.
            if (!preg_match('/^[+-]?\d{1,2}([.]\d{1,2})?$/', $value)) {
                throw new \InvalidArgumentException('Prescription values must look like -2.25 or +1.5');
            }
            $payload[$field] = $value;
        }
        foreach (['rx_axis_r', 'rx_axis_l'] as $field) {
            $value = trim((string) ($raw[$field] ?? ''));
            if ($value === '') {
                $payload[$field] = null;
                continue;
            }
            $axis = (int) $value;
            if ($axis < 0 || $axis > 180) {
                throw new \InvalidArgumentException('Axis must be between 0 and 180');
            }
            $payload[$field] = $axis;
        }

        $payload['impression'] = mb_substr(trim((string) ($raw['impression'] ?? '')), 0, 1000) ?: null;
        $payload['refer'] = !empty($raw['refer']) ? 1 : 0;

        return $payload;
    }

    /**
     * @param mixed $raw
     * @param array<string, string> $catalog
     */
    private function cleanFindings($raw, array $catalog): ?string
    {
        if (!is_array($raw)) {
            return null;
        }
        $keep = [];
        foreach ($raw as $code) {
            $code = (string) $code;
            if (isset($catalog[$code])) {
                $keep[$code] = true;
            }
        }

        return $keep === [] ? null : implode(',', array_keys($keep));
    }

    /**
     * Latest active exam on the encounter.
     *
     * @return array{id: int, values: array<string, mixed>}|null
     */
    private function loadLatest(int $pid, int $encounter): ?array
    {
        if ($encounter <= 0) {
            return null;
        }

        $row = QueryUtils::fetchRecords(
            "SELECT e.*
             FROM forms f
             JOIN form_nc_eye_exam e ON e.id = f.form_id
             WHERE f.encounter = ? AND f.pid = ? AND f.formdir = ? AND f.deleted = 0
             ORDER BY f.date DESC
             LIMIT 1",
            [$encounter, $pid, self::FORMDIR]
        );

        if (empty($row[0])) {
            return null;
        }

        $values = $row[0];
        $id = (int) $values['id'];
        unset($values['id'], $values['uuid'], $values['groupname'], $values['authorized'], $values['activity'], $values['user'], $values['date'], $values['pid'], $values['encounter']);
        foreach (['antseg_r', 'antseg_l', 'fundus_r', 'fundus_l'] as $csv) {
            $values[$csv] = $values[$csv] !== null && $values[$csv] !== ''
                ? explode(',', (string) $values[$csv])
                : [];
        }
        // Tinyints come back as STRINGS ("0"/"1") and Boolean("0") is TRUE in
        // JS — cast so the drawer's checkboxes round-trip correctly.
        foreach (['pupils_equal_reactive', 'rapd_r', 'rapd_l', 'fundus_examined_r', 'fundus_examined_l', 'refer'] as $flag) {
            $values[$flag] = (int) ($values[$flag] ?? 0);
        }

        return ['id' => $id, 'values' => $values];
    }

    private function assertEnabled(int $facilityId): void
    {
        if (!$this->config->isEnabled('enable_native_eye_exam', 0, $facilityId)) {
            throw new \RuntimeException('The native eye exam is not enabled', 403);
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

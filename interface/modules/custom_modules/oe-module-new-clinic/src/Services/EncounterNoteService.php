<?php

/**
 * V1.2-DOC-HLF-2/3 — native encounter consult note (get / save / prefill / validate / sign)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Auth\AuthUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\FormService;

class EncounterNoteService
{
    public const NATIVE_FORMDIR = 'nc_encounter_consult';
    public const ENGINE_LEGACY = 'legacy';
    public const ENGINE_NATIVE = 'native';
    public const DEFAULT_VARIANT = 'general_opd';

    /** @var list<string> */
    public const VALID_VARIANTS = [
        'general_opd',
        'referral_consult',
        'follow_up',
        'pre_procedure',
    ];

    private static bool $schemaEnsured = false;

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VitalsPreviewBuilder $vitalsPreview = new VitalsPreviewBuilder(),
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly DoctorService $doctorService = new DoctorService(),
    ) {
    }

    public function isNativeEngineEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $engine = strtolower(trim((string) ($this->config->get(
            'encounter_note_engine',
            self::ENGINE_LEGACY,
            $facilityId
        ) ?? self::ENGINE_LEGACY)));

        return $engine === self::ENGINE_NATIVE;
    }

    public function effectiveConsultFormdir(?int $facilityId = null): string
    {
        if ($this->isNativeEngineEnabled($facilityId)) {
            return self::NATIVE_FORMDIR;
        }

        $formdir = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));

        return $formdir !== '' ? $formdir : 'soap';
    }

    public function isNativeFormdir(string $formdir): bool
    {
        return strcasecmp(trim($formdir), self::NATIVE_FORMDIR) === 0;
    }

    public function shouldOpenNativeForm(string $formdir, ?int $facilityId = null): bool
    {
        if (!$this->isNativeEngineEnabled($facilityId)) {
            return false;
        }

        $formdir = strtolower(trim($formdir));

        return $formdir === self::NATIVE_FORMDIR
            || $formdir === strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
    }

    /**
     * @return array<string, mixed>
     */
    public function get(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $visit = $this->loadClinicalVisit($visitId, $actorUserId);
        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        $row = $this->loadNoteRow($visitId);
        $formsRowId = isset($row['forms_row_id']) ? (int) $row['forms_row_id'] : 0;
        $storedVariant = (string) ($row['variant'] ?? '');
        $variant = $storedVariant !== ''
            ? $this->normalizeVariant($storedVariant)
            : $this->resolveVariantForVisit($visit, $facilityId);

        return [
            'visit_id' => $visitId,
            'encounter' => (int) ($visit['encounter'] ?? 0),
            'pid' => (int) ($visit['pid'] ?? 0),
            'variant' => $variant,
            'sections' => $this->decodeSections($row['payload'] ?? null),
            'forms_row_id' => $formsRowId > 0 ? $formsRowId : null,
            'form_id' => $formsRowId > 0 ? $formsRowId : null,
            'updated_at' => $row['updated_at'] ?? null,
            'signed' => $formsRowId > 0 && $this->isFormSigned($formsRowId),
            'prefill' => $this->buildPrefill($visit),
            'return_url' => $this->defaultReturnUrl($visitId),
            'engine' => self::ENGINE_NATIVE,
            'native_formdir' => self::NATIVE_FORMDIR,
            'facility_id' => $facilityId,
            'note_config' => $this->getNoteConfig($facilityId),
            'supervisor' => $this->doctorService->getSupervisorMeta(
                (int) ($visit['encounter'] ?? 0),
                $actorUserId
            ),
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function validate(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $visitId = (int) ($body['visit_id'] ?? 0);
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->loadClinicalVisit($visitId, $actorUserId);
        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        $sections = $body['sections'] ?? null;
        if (!is_array($sections)) {
            $row = $this->loadNoteRow($visitId);
            $sections = $this->decodeSections($row['payload'] ?? null);
        }

        $variant = $this->resolveVariantFromBody($body, $visit, $facilityId);

        return $this->buildValidationResult(
            $sections,
            $this->buildPrefill($visit),
            $variant,
            $facilityId,
            $this->doctorService->getSupervisorMeta((int) ($visit['encounter'] ?? 0), $actorUserId)
        );
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function sign(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $visitId = (int) ($body['visit_id'] ?? 0);
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $password = (string) ($body['password'] ?? '');
        if (trim($password) === '') {
            throw new \InvalidArgumentException('Password is required to sign');
        }

        if (!(new AuthUtils())->confirmPassword($_SESSION['authUser'] ?? '', $password)) {
            throw new \InvalidArgumentException('The password you entered is invalid');
        }

        $visit = $this->loadClinicalVisit($visitId, $actorUserId);
        $sections = $body['sections'] ?? null;
        if (is_array($sections)) {
            $this->save([
                'visit_id' => $visitId,
                'variant' => $body['variant'] ?? self::DEFAULT_VARIANT,
                'sections' => $sections,
            ], $actorUserId);
        }

        $row = $this->loadNoteRow($visitId);
        if ($row === null) {
            throw new \RuntimeException('Save the consult note before signing', 409);
        }

        $formsRowId = (int) ($row['forms_row_id'] ?? 0);
        if ($formsRowId <= 0) {
            throw new \RuntimeException('Consult note is missing a forms row', 409);
        }

        if ($this->isFormSigned($formsRowId)) {
            return [
                'visit_id' => $visitId,
                'forms_row_id' => $formsRowId,
                'signed' => true,
                'already_signed' => true,
            ];
        }

        $decodedSections = $this->decodeSections($row['payload'] ?? null);
        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        $variant = $this->resolveVariantFromBody($body, $visit, $facilityId, (string) ($row['variant'] ?? ''));
        $validation = $this->buildValidationResult(
            $decodedSections,
            $this->buildPrefill($visit),
            $variant,
            $facilityId,
            $this->doctorService->getSupervisorMeta((int) ($visit['encounter'] ?? 0), $actorUserId)
        );
        if (!$validation['valid']) {
            throw new \InvalidArgumentException('Consult note is incomplete — run Validate and fix required fields');
        }

        $this->insertFormSignature($row, $actorUserId, trim((string) ($body['amendment'] ?? '')));

        $problemCount = $this->countActiveProblems($decodedSections);
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'encounter_note_signed',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'visit_id' => $visitId,
                'encounter_id' => (int) ($row['encounter'] ?? 0),
                'forms_row_id' => $formsRowId,
                'variant' => $variant,
                'problem_count' => $problemCount,
            ]),
            (int) ($row['pid'] ?? 0)
        );

        return [
            'visit_id' => $visitId,
            'forms_row_id' => $formsRowId,
            'signed' => true,
            'already_signed' => false,
        ];
    }

    public function resolveVisitIdFromFormsRow(int $formsRowId): int
    {
        if ($formsRowId <= 0) {
            return 0;
        }

        $this->ensureTableExists();
        $noteRow = QueryUtils::querySingleRow(
            'SELECT visit_id FROM nc_encounter_note WHERE forms_row_id = ? LIMIT 1',
            [$formsRowId]
        );
        if (is_array($noteRow)) {
            return (int) ($noteRow['visit_id'] ?? 0);
        }

        $formRow = QueryUtils::querySingleRow(
            'SELECT encounter, pid FROM forms
             WHERE id = ? AND deleted = 0 AND LOWER(formdir) = ?
             LIMIT 1',
            [$formsRowId, self::NATIVE_FORMDIR]
        );
        if (!is_array($formRow)) {
            return 0;
        }

        $visitRow = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit
             WHERE encounter = ? AND pid = ?
             AND state NOT IN (\'completed\', \'closed_unpaid\', \'cancelled\')
             ORDER BY id DESC LIMIT 1',
            [(int) ($formRow['encounter'] ?? 0), (int) ($formRow['pid'] ?? 0)]
        );

        return is_array($visitRow) ? (int) ($visitRow['id'] ?? 0) : 0;
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function save(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $visitId = (int) ($body['visit_id'] ?? 0);
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->loadClinicalVisit($visitId, $actorUserId);
        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        if (!$this->isNativeEngineEnabled($facilityId)) {
            throw new \RuntimeException('Native encounter note engine is not enabled', 403);
        }

        $encounter = (int) ($visit['encounter'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);
        if ($encounter <= 0 || $pid <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        $variant = $this->resolveVariantFromBody($body, $visit, $facilityId);
        if ($variant === '') {
            $variant = self::DEFAULT_VARIANT;
        }

        $sections = $body['sections'] ?? [];
        if (!is_array($sections)) {
            throw new \InvalidArgumentException('sections must be an object');
        }

        $payload = json_encode(['sections' => $sections], JSON_THROW_ON_ERROR);
        $existing = $this->loadNoteRow($visitId);
        $this->ensureTableExists();

        if ($existing === null) {
            $noteId = QueryUtils::sqlInsert(
                'INSERT INTO nc_encounter_note
                    (facility_id, visit_id, encounter, pid, forms_row_id, variant, payload, author_user_id, updated_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(), NOW())',
                [$facilityId, $visitId, $encounter, $pid, $variant, $payload, $actorUserId, $actorUserId]
            );
            $formsRowId = (new FormService())->addForm(
                $encounter,
                xl('Consultation note'),
                (int) $noteId,
                self::NATIVE_FORMDIR,
                $pid,
                '1'
            );
            QueryUtils::sqlStatementThrowException(
                'UPDATE nc_encounter_note SET forms_row_id = ? WHERE id = ?',
                [(int) $formsRowId, (int) $noteId]
            );
            $formsRowId = (int) $formsRowId;
        } else {
            $noteId = (int) ($existing['id'] ?? 0);
            QueryUtils::sqlStatementThrowException(
                'UPDATE nc_encounter_note
                 SET variant = ?, payload = ?, updated_by = ?, updated_at = NOW()
                 WHERE id = ?',
                [$variant, $payload, $actorUserId, $noteId]
            );
            $formsRowId = (int) ($existing['forms_row_id'] ?? 0);
            if ($formsRowId > 0) {
                QueryUtils::sqlStatementThrowException(
                    'UPDATE forms SET date = NOW(), user = ? WHERE id = ? AND deleted = 0',
                    [$_SESSION['authUser'] ?? 'system', $formsRowId]
                );
            }
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'encounter_note_saved',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'visit_id' => $visitId,
                'encounter_id' => $encounter,
                'forms_row_id' => $formsRowId,
                'variant' => $variant,
            ]),
            0
        );

        return [
            'visit_id' => $visitId,
            'forms_row_id' => $formsRowId > 0 ? $formsRowId : null,
            'form_id' => $formsRowId > 0 ? $formsRowId : null,
            'updated_at' => date('Y-m-d H:i:s'),
            'saved' => true,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function prefill(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $visit = $this->loadClinicalVisit($visitId, $actorUserId);

        return $this->buildPrefill($visit);
    }

    /**
     * @param array<string, mixed> $query
     */
    public function buildPageUrl(int $visitId, array $query = []): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $params = array_merge(['visit_id' => (string) $visitId], $query);

        return $modulePublic . 'encounter-consult.php?' . http_build_query($params);
    }

    /**
     * V1.2-DOC-HLF-4 — hub card + MRD summary preview for native consult note.
     *
     * @return array<string, mixed>
     */
    public function buildNotePreview(int $visitId, ?int $facilityId = null): array
    {
        if ($visitId <= 0) {
            return $this->emptyNotePreview(false);
        }

        $visit = QueryUtils::querySingleRow(
            'SELECT v.id, v.chief_complaint, v.visit_type_id, v.encounter, v.pid, v.facility_id,
                    v.queue_number, CONCAT(pd.fname, " ", pd.lname) AS patient_name
             FROM new_visit v
             LEFT JOIN patient_data pd ON pd.pid = v.pid
             WHERE v.id = ?
             LIMIT 1',
            [$visitId]
        );
        if (!is_array($visit)) {
            return $this->emptyNotePreview(false);
        }

        if ($facilityId === null || $facilityId < 0) {
            $facilityId = (int) ($visit['facility_id'] ?? 0);
        }

        if (!$this->isNativeEngineEnabled($facilityId)) {
            return $this->emptyNotePreview(false);
        }

        $row = $this->loadNoteRow($visitId);
        $sections = $row !== null
            ? $this->decodeSections($row['payload'] ?? null)
            : $this->emptySections();
        $storedVariant = $row !== null ? (string) ($row['variant'] ?? '') : '';
        $variant = $storedVariant !== ''
            ? $this->normalizeVariant($storedVariant)
            : $this->resolveVariantForVisit($visit, $facilityId);
        $formsRowId = $row !== null ? (int) ($row['forms_row_id'] ?? 0) : 0;
        $signed = $formsRowId > 0 && $this->isFormSigned($formsRowId);
        $problemCount = $this->countActiveProblems($sections);
        $incompleteProblemCount = $this->countIncompleteProblems($sections, $variant, $facilityId);
        $ccPreview = $this->buildCcPreview($sections, $visit);
        $validateReady = false;
        if (!$signed && $row !== null) {
            $prefill = $this->buildPrefill($visit);
            $validation = $this->buildValidationResult(
                $sections,
                $prefill,
                $variant,
                $facilityId,
                []
            );
            $validateReady = !empty($validation['valid']);
        }

        return [
            'native_enabled' => true,
            'started' => $row !== null,
            'signed' => $signed,
            'variant' => $variant,
            'variant_label' => $this->variantDisplayLabel($variant),
            'cc_preview' => $ccPreview !== '' ? $ccPreview : null,
            'problem_count' => $problemCount,
            'incomplete_problem_count' => $incompleteProblemCount,
            'problem_labels' => $this->extractProblemLabels($sections),
            'validate_ready' => $validateReady,
            'updated_at' => $row['updated_at'] ?? null,
            'open_url' => $this->buildPageUrl($visitId, ['return_to' => 'hub', 'tab' => 'consult']),
        ];
    }

    public function variantDisplayLabel(string $variant): string
    {
        return match ($this->normalizeVariant($variant)) {
            'referral_consult' => xl('Referral consult'),
            'follow_up' => xl('Follow-up'),
            'pre_procedure' => xl('Pre-procedure'),
            default => xl('General OPD'),
        };
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function buildPrefill(array $visit): array
    {
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $vitalsRows = $encounter > 0 && $pid > 0
            ? $this->vitalsPreview->getEncounterVitals($pid, $encounter)
            : [];
        $warnings = $this->vitalsPreview->evaluateWarnings($vitalsRows);
        $latest = $this->vitalsPreview->formatLatestForForm($vitalsRows);
        $preview = $this->vitalsPreview->mergeIntoPreview([], $vitalsRows, $warnings, true);
        $allergies = $this->loadAllergiesPrefill($pid);
        $medications = $this->loadMedicationsPrefill($pid, $encounter);

        return [
            'chief_complaint' => trim((string) ($visit['chief_complaint'] ?? '')),
            'vitals' => [
                'latest' => $latest,
                'summary' => $preview['vitals_today']['summary'] ?? null,
                'warnings' => $warnings,
                'abnormal' => !empty($warnings),
                'missing' => empty($vitalsRows),
            ],
            'allergies' => $allergies,
            'medications' => $medications,
            'patient' => [
                'display_name' => trim((string) ($visit['patient_name'] ?? '')),
                'queue_number' => (int) ($visit['queue_number'] ?? 0),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadAllergiesPrefill(int $pid): array
    {
        $webroot = $GLOBALS['webroot'] ?? '';
        $rows = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1 ORDER BY id DESC LIMIT 8",
            [$pid]
        ) ?: [];
        $items = [];
        $nkda = false;
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            if (PatientCompletionService::isNkdaOnlyTitle($title)) {
                $nkda = true;
                continue;
            }
            $items[] = $title;
        }

        $undocumented = !$this->completionService->hasAllergyDocumentationForPatient($pid);
        $summary = $undocumented
            ? xl('Allergies not documented')
            : ($nkda && $items === [] ? xl('No known drug allergies') : implode('; ', $items));

        return [
            'items' => $items,
            'undocumented' => $undocumented,
            'nkda' => $nkda,
            'summary' => $summary !== '' ? $summary : null,
            'edit_url' => $webroot . '/interface/patient_file/summary/stats_full.php?active=all&set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadMedicationsPrefill(int $pid, int $encounter): array
    {
        $webroot = $GLOBALS['webroot'] ?? '';
        $items = [];
        if ($encounter > 0) {
            $rxRows = QueryUtils::fetchRecords(
                'SELECT drug FROM prescriptions
                 WHERE patient_id = ? AND encounter = ? AND active = 1
                 ORDER BY date_modified DESC LIMIT 8',
                [$pid, $encounter]
            ) ?: [];
            foreach ($rxRows as $row) {
                $drug = trim((string) ($row['drug'] ?? ''));
                if ($drug !== '') {
                    $items[] = $drug;
                }
            }
        }

        if ($items === []) {
            $listRows = QueryUtils::fetchRecords(
                "SELECT title FROM lists WHERE pid = ? AND type = 'medication' AND activity = 1 ORDER BY id DESC LIMIT 8",
                [$pid]
            ) ?: [];
            foreach ($listRows as $row) {
                $title = trim((string) ($row['title'] ?? ''));
                if ($title !== '') {
                    $items[] = $title;
                }
            }
        }

        $items = array_values(array_unique($items));

        return [
            'items' => $items,
            'summary' => $items !== [] ? implode('; ', $items) : null,
            'edit_url' => $webroot . '/interface/patient_file/summary/stats_full.php?active=med&set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $prefill
     * @param array<string, mixed> $supervisor
     * @return array<string, mixed>
     */
    private function buildValidationResult(
        array $sections,
        array $prefill,
        string $variant,
        int $facilityId,
        array $supervisor = []
    ): array {
        $errors = [];
        $variant = $this->normalizeVariant($variant);
        $config = $this->getNoteConfig($facilityId);
        $visible = $this->visibleSectionsForVariant($variant);

        if (trim((string) ($sections['cc']['chief_complaint'] ?? '')) === '') {
            $errors[] = ['section' => 'cc', 'field' => 'chief_complaint', 'message' => xl('Chief complaint is required')];
        }

        $hpiMessage = $variant === 'follow_up'
            ? xl('Interval history is required for follow-up visits')
            : xl('History of present illness is required');
        if (trim((string) ($sections['hpi']['narrative'] ?? '')) === '') {
            $errors[] = ['section' => 'hpi', 'field' => 'narrative', 'message' => $hpiMessage];
        }

        if (trim((string) ($sections['pe']['general'] ?? '')) === '') {
            $errors[] = ['section' => 'pe', 'field' => 'general', 'message' => xl('Physical examination is required')];
        }

        if (in_array('referral', $visible, true)) {
            if (trim((string) ($sections['referral']['requesting_clinician'] ?? '')) === '') {
                $errors[] = ['section' => 'referral', 'field' => 'requesting_clinician', 'message' => xl('Requesting clinician is required')];
            }
            if (trim((string) ($sections['referral']['requesting_service'] ?? '')) === '') {
                $errors[] = ['section' => 'referral', 'field' => 'requesting_service', 'message' => xl('Requesting service is required')];
            }
            if (trim((string) ($sections['referral']['clinical_question'] ?? '')) === '') {
                $errors[] = ['section' => 'referral', 'field' => 'clinical_question', 'message' => xl('Clinical question is required for referral consults')];
            }
        }

        if (in_array('source', $visible, true)) {
            $sources = $sections['source']['sources'] ?? [];
            $sourceNarrative = trim((string) ($sections['source']['narrative'] ?? ''));
            if ((!is_array($sources) || $sources === []) && $sourceNarrative === '') {
                $errors[] = ['section' => 'source', 'field' => 'sources', 'message' => xl('Select at least one source of information or add a narrative')];
            }
        }

        $this->appendProblemValidationErrors($sections, $variant, $config, $errors);

        if (in_array('attestation', $visible, true) && !empty($config['supervisor_required'])) {
            if (empty($supervisor['supervisor_id'])) {
                $errors[] = ['section' => 'attestation', 'field' => 'supervisor_id', 'message' => xl('Select a supervising provider before signing')];
            }
            if (empty($sections['attestation']['supervisor_attested'])) {
                $errors[] = ['section' => 'attestation', 'field' => 'supervisor_attested', 'message' => xl('Supervisor attestation is required before signing')];
            }
        }

        $allergies = is_array($prefill['allergies'] ?? null) ? $prefill['allergies'] : [];
        $requiresAllergyAck = !empty($allergies['undocumented'])
            || !empty($allergies['nkda'])
            || !empty($allergies['items']);
        if ($requiresAllergyAck && empty($sections['context']['allergies_acknowledged'])) {
            $errors[] = [
                'section' => 'context',
                'field' => 'allergies_acknowledged',
                'message' => xl('Review and acknowledge allergies before signing'),
            ];
        }

        $medications = is_array($prefill['medications'] ?? null) ? $prefill['medications'] : [];
        if (!empty($medications['items']) && empty($sections['context']['meds_acknowledged'])) {
            $errors[] = [
                'section' => 'context',
                'field' => 'meds_acknowledged',
                'message' => xl('Review and acknowledge medications before signing'),
            ];
        }

        return [
            'valid' => $errors === [],
            'errors' => $errors,
        ];
    }

    /**
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $config
     * @param list<array{section: string, field: string, message: string}> $errors
     */
    private function appendProblemValidationErrors(array $sections, string $variant, array $config, array &$errors): void
    {
        $items = is_array($sections['problems']['items'] ?? null) ? $sections['problems']['items'] : [];
        $active = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if (strtolower(trim((string) ($item['status'] ?? ''))) === 'resolved') {
                continue;
            }
            $active[] = $item;
        }

        $legacyAssessment = trim((string) ($sections['assessment']['narrative'] ?? ''));
        $legacyPlan = trim((string) ($sections['plan']['narrative'] ?? ''));
        if ($active === [] && ($legacyAssessment === '' || $legacyPlan === '')) {
            $errors[] = ['section' => 'problems', 'field' => 'items', 'message' => xl('Add at least one active problem with assessment and plan')];
            return;
        }

        if ($active === []) {
            return;
        }

        foreach ($active as $index => $problem) {
            $label = trim((string) ($problem['problem_label'] ?? ''));
            if ($label === '') {
                $errors[] = [
                    'section' => 'problems',
                    'field' => 'problem_' . $index . '_label',
                    'message' => xl('Problem') . ' ' . ($index + 1) . ': ' . xl('label is required'),
                ];
            }

            if (!empty($config['require_icd']) && trim((string) ($problem['icd10_code'] ?? '')) === '') {
                $errors[] = [
                    'section' => 'problems',
                    'field' => 'problem_' . $index . '_icd10_code',
                    'message' => xl('Problem') . ' ' . ($index + 1) . ': ' . xl('ICD-10 code is required'),
                ];
            }

            if ($variant === 'referral_consult' && trim((string) ($problem['differential'] ?? '')) === '') {
                $errors[] = [
                    'section' => 'problems',
                    'field' => 'problem_' . $index . '_differential',
                    'message' => xl('Problem') . ' ' . ($index + 1) . ': ' . xl('differential diagnosis is required for referral consults'),
                ];
            }

            $planItems = is_array($problem['plan_items'] ?? null) ? $problem['plan_items'] : [];
            $hasPlan = false;
            foreach ($planItems as $planItem) {
                if (!is_array($planItem)) {
                    continue;
                }
                if (trim((string) ($planItem['text'] ?? '')) !== '') {
                    $hasPlan = true;
                    break;
                }
            }
            if (!$hasPlan) {
                $errors[] = [
                    'section' => 'problems',
                    'field' => 'problem_' . $index . '_plan_items',
                    'message' => xl('Problem') . ' ' . ($index + 1) . ': ' . xl('add at least one plan item'),
                ];
            }
        }

        if ($variant === 'pre_procedure') {
            $hasClearance = false;
            foreach ($active as $problem) {
                $planItems = is_array($problem['plan_items'] ?? null) ? $problem['plan_items'] : [];
                foreach ($planItems as $planItem) {
                    if (!is_array($planItem)) {
                        continue;
                    }
                    $text = strtolower(trim((string) ($planItem['text'] ?? '')));
                    if (str_contains($text, 'clearance') || str_contains($text, 'cleared')) {
                        $hasClearance = true;
                        break 2;
                    }
                }
            }
            if (!$hasClearance) {
                $errors[] = [
                    'section' => 'problems',
                    'field' => 'clearance',
                    'message' => xl('Pre-procedure visit requires a clearance statement in the plan'),
                ];
            }
        }
    }

    /**
     * @return array{require_icd: bool, supervisor_required: bool}
     */
    private function getNoteConfig(int $facilityId): array
    {
        return [
            'require_icd' => $this->config->getInt('encounter_note_require_icd', 0, $facilityId) === 1,
            'supervisor_required' => $this->config->getInt('encounter_note_supervisor_required', 0, $facilityId) === 1,
        ];
    }

    /**
     * @return list<string>
     */
    private function visibleSectionsForVariant(string $variant): array
    {
        $variant = $this->normalizeVariant($variant);

        return match ($variant) {
            'referral_consult' => ['referral', 'source', 'cc', 'hpi', 'vitals', 'pe', 'problems', 'attestation'],
            'follow_up' => ['cc', 'hpi', 'vitals', 'pe', 'problems'],
            'pre_procedure' => ['source', 'cc', 'hpi', 'vitals', 'pe', 'problems', 'attestation'],
            default => ['cc', 'hpi', 'vitals', 'pe', 'problems'],
        };
    }

    private function normalizeVariant(string $variant): string
    {
        $variant = strtolower(trim($variant));

        return in_array($variant, self::VALID_VARIANTS, true) ? $variant : self::DEFAULT_VARIANT;
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function resolveVariantForVisit(array $visit, int $facilityId): string
    {
        $visitTypeId = (int) ($visit['visit_type_id'] ?? 0);
        if ($visitTypeId <= 0) {
            return self::DEFAULT_VARIANT;
        }

        $visitType = QueryUtils::querySingleRow(
            'SELECT label, referral_required FROM new_visit_type WHERE id = ? LIMIT 1',
            [$visitTypeId]
        );
        if (!is_array($visitType)) {
            return self::DEFAULT_VARIANT;
        }

        $label = trim((string) ($visitType['label'] ?? ''));
        $map = $this->loadVariantMap($facilityId);
        if ($label !== '' && isset($map[$label])) {
            return $this->normalizeVariant((string) $map[$label]);
        }

        if (!empty($visitType['referral_required'])) {
            return 'referral_consult';
        }

        return self::DEFAULT_VARIANT;
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, mixed> $visit
     */
    private function resolveVariantFromBody(array $body, array $visit, int $facilityId, string $storedVariant = ''): string
    {
        $requested = trim((string) ($body['variant'] ?? ''));
        if ($requested !== '') {
            return $this->normalizeVariant($requested);
        }

        if ($storedVariant !== '') {
            return $this->normalizeVariant($storedVariant);
        }

        return $this->resolveVariantForVisit($visit, $facilityId);
    }

    /**
     * @return array<string, string>
     */
    private function loadVariantMap(int $facilityId): array
    {
        $raw = trim((string) ($this->config->get('encounter_note_variant_map', '{}', $facilityId) ?? '{}'));
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $map = [];
        foreach ($decoded as $visitTypeLabel => $variant) {
            $label = trim((string) $visitTypeLabel);
            if ($label === '') {
                continue;
            }
            $map[$label] = $this->normalizeVariant((string) $variant);
        }

        return $map;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyNotePreview(bool $nativeEnabled = true): array
    {
        return [
            'native_enabled' => $nativeEnabled,
            'started' => false,
            'signed' => false,
            'variant' => self::DEFAULT_VARIANT,
            'variant_label' => $this->variantDisplayLabel(self::DEFAULT_VARIANT),
            'cc_preview' => null,
            'problem_count' => 0,
            'incomplete_problem_count' => 0,
            'problem_labels' => [],
            'validate_ready' => false,
            'updated_at' => null,
            'open_url' => null,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function buildCcPreview(array $sections, array $visit): string
    {
        $cc = trim((string) ($sections['cc']['chief_complaint'] ?? ''));
        if ($cc === '') {
            $cc = trim((string) ($visit['chief_complaint'] ?? ''));
        }

        if ($cc === '') {
            return '';
        }

        $firstLine = trim(strtok($cc, "\r\n"));
        if (mb_strlen($firstLine) > 120) {
            return mb_substr($firstLine, 0, 117) . '…';
        }

        return $firstLine;
    }

    /**
     * @param array<string, mixed> $sections
     * @return list<string>
     */
    private function extractProblemLabels(array $sections): array
    {
        $items = is_array($sections['problems']['items'] ?? null) ? $sections['problems']['items'] : [];
        $labels = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if (strtolower(trim((string) ($item['status'] ?? ''))) === 'resolved') {
                continue;
            }
            $label = trim((string) ($item['problem_label'] ?? ''));
            if ($label !== '') {
                $labels[] = $label;
            }
            if (count($labels) >= 5) {
                break;
            }
        }

        return $labels;
    }

    private function countIncompleteProblems(array $sections, string $variant, int $facilityId): int
    {
        $config = $this->getNoteConfig($facilityId);
        $variant = $this->normalizeVariant($variant);
        $items = is_array($sections['problems']['items'] ?? null) ? $sections['problems']['items'] : [];
        $incomplete = 0;

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if (strtolower(trim((string) ($item['status'] ?? ''))) === 'resolved') {
                continue;
            }

            $label = trim((string) ($item['problem_label'] ?? ''));
            if ($label === '') {
                $incomplete++;
                continue;
            }

            if (!empty($config['require_icd']) && trim((string) ($item['icd10_code'] ?? '')) === '') {
                $incomplete++;
                continue;
            }

            if ($variant === 'referral_consult' && trim((string) ($item['differential'] ?? '')) === '') {
                $incomplete++;
                continue;
            }

            $planItems = is_array($item['plan_items'] ?? null) ? $item['plan_items'] : [];
            $hasPlan = false;
            foreach ($planItems as $planItem) {
                if (!is_array($planItem)) {
                    continue;
                }
                if (trim((string) ($planItem['text'] ?? '')) !== '') {
                    $hasPlan = true;
                    break;
                }
            }
            if (!$hasPlan) {
                $incomplete++;
            }
        }

        return $incomplete;
    }

    /**
     * @param array<string, mixed> $sections
     */
    private function countActiveProblems(array $sections): int
    {
        $items = is_array($sections['problems']['items'] ?? null) ? $sections['problems']['items'] : [];
        $count = 0;
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if (strtolower(trim((string) ($item['status'] ?? ''))) === 'resolved') {
                continue;
            }
            if (trim((string) ($item['problem_label'] ?? '')) !== '') {
                $count++;
            }
        }

        return $count;
    }

    private function isFormSigned(int $formsRowId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM esign_signatures
             WHERE tid = ? AND `table` = 'forms' AND is_lock = 1
             LIMIT 1",
            [$formsRowId]
        );

        return is_array($row);
    }

    /**
     * @param array<string, mixed> $row
     */
    private function insertFormSignature(array $row, int $actorUserId, string $amendment): void
    {
        require_once $GLOBALS['srcdir'] . '/ESign/Utils/Verification.php';

        $formsRowId = (int) ($row['forms_row_id'] ?? 0);
        $verification = new \ESign\Utils_Verification();
        $hash = $verification->hash($this->buildSignablePayload($row));
        $signature = [
            $formsRowId,
            'forms',
            $actorUserId,
            1,
            $hash,
            $amendment !== '' ? $amendment : null,
        ];
        $signatureHash = $verification->hash($signature);
        $signature[] = $signatureHash;

        QueryUtils::sqlInsert(
            'INSERT INTO esign_signatures (tid, `table`, uid, datetime, is_lock, hash, amendment, signature_hash)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)',
            $signature
        );
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function buildSignablePayload(array $row): array
    {
        $payload = $row['payload'] ?? '';
        $decoded = is_string($payload) ? json_decode($payload, true) : $payload;

        return [
            'visit_id' => (int) ($row['visit_id'] ?? 0),
            'encounter' => (int) ($row['encounter'] ?? 0),
            'pid' => (int) ($row['pid'] ?? 0),
            'variant' => (string) ($row['variant'] ?? self::DEFAULT_VARIANT),
            'sections' => is_array($decoded) ? ($decoded['sections'] ?? []) : [],
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadClinicalVisit(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        $clinicalStates = [
            'awaiting_triage', 'in_triage', 'with_doctor',
            'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
        ];
        if (!in_array($state, $clinicalStates, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }

        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        $this->encounterSession->assertBound($visitId);

        return $visit;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadNoteRow(int $visitId): ?array
    {
        $this->ensureTableExists();
        $row = QueryUtils::querySingleRow(
            'SELECT id, visit_id, encounter, pid, forms_row_id, variant, payload, updated_at
             FROM nc_encounter_note
             WHERE visit_id = ?
             LIMIT 1',
            [$visitId]
        );

        return is_array($row) ? $row : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeSections(mixed $payload): array
    {
        if ($payload === null || $payload === '') {
            return $this->emptySections();
        }

        $decoded = is_string($payload) ? json_decode($payload, true) : $payload;
        if (!is_array($decoded)) {
            return $this->emptySections();
        }

        $sections = $decoded['sections'] ?? [];
        if (!is_array($sections)) {
            return $this->emptySections();
        }

        $merged = array_merge($this->emptySections(), $sections);
        foreach (['hpi', 'referral', 'source', 'context', 'attestation'] as $nestedKey) {
            if (isset($sections[$nestedKey]) && is_array($sections[$nestedKey])) {
                $merged[$nestedKey] = array_merge($this->emptySections()[$nestedKey], $sections[$nestedKey]);
            }
        }
        if (isset($sections['problems']) && is_array($sections['problems'])) {
            $merged['problems'] = [
                'items' => is_array($sections['problems']['items'] ?? null) ? $sections['problems']['items'] : [],
            ];
        }

        return $merged;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptySections(): array
    {
        return [
            'referral' => [
                'requesting_clinician' => '',
                'requesting_service' => '',
                'clinical_question' => '',
                'urgency' => '',
            ],
            'source' => [
                'sources' => [],
                'narrative' => '',
            ],
            'cc' => ['chief_complaint' => ''],
            'hpi' => [
                'narrative' => '',
                'onset' => '',
                'duration' => '',
                'severity' => '',
                'aggravating' => '',
                'relieving' => '',
            ],
            'pe' => ['general' => ''],
            'problems' => ['items' => []],
            'assessment' => ['narrative' => ''],
            'plan' => ['narrative' => ''],
            'attestation' => [
                'supervisor_attested' => false,
            ],
            'context' => [
                'allergies_acknowledged' => false,
                'meds_acknowledged' => false,
            ],
        ];
    }

    private function defaultReturnUrl(int $visitId): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        return $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
            . '&tab=' . urlencode('consult');
    }

    private function ensureTableExists(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        sqlStatement(
            'CREATE TABLE IF NOT EXISTS `nc_encounter_note` (
                `id` BIGINT NOT NULL AUTO_INCREMENT,
                `facility_id` INT NOT NULL,
                `visit_id` BIGINT NOT NULL,
                `encounter` INT NOT NULL,
                `pid` BIGINT NOT NULL,
                `forms_row_id` BIGINT NULL,
                `variant` VARCHAR(32) NOT NULL DEFAULT \'general_opd\',
                `payload` JSON NOT NULL,
                `author_user_id` BIGINT NOT NULL,
                `updated_by` BIGINT NOT NULL,
                `created_at` DATETIME NOT NULL,
                `updated_at` DATETIME NOT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_visit_note` (`visit_id`),
                KEY `idx_encounter_note` (`encounter`),
                KEY `idx_facility_updated` (`facility_id`, `updated_at`)
            ) ENGINE=InnoDB COMMENT=\'V1.2-DOC-HLF-2 native encounter consult note\''
        );

        self::$schemaEnsured = true;
    }
}

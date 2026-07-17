<?php

/**
 * Native Vitals editor — read/write service for the Clinical Documentation hub.
 *
 * Backs the native React vitals drawer that is the default editor for the stock
 * `vitals` encounter form card (no feature flag — same pattern as the native
 * Clinical Instructions and screening editors). Reuses the module's proven
 * vitals machinery: `VitalsValidationService` (metric ranges + normal-range
 * warnings + temperature storage normalization) and the core
 * `EncounterService::insertVital` / `VitalsService::save` write paths, so the
 * canonical `form_vitals` row + `forms` registry row are written exactly as
 * triage writes them (module convention: weight kg / height cm stored raw,
 * temperature per the units global).
 *
 * Adds what the stock/triage paths lack for the doctor workflow: BMI + BMI
 * status computed server-side on save, and edit-in-place of an existing vitals
 * set (the card's Continue), while a first save creates a new set. The stock
 * form stays reachable via the encounter's Advanced view.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Modules\NewClinic\Exceptions\VitalsValidationException;
use OpenEMR\Services\EncounterService;
use OpenEMR\Services\VitalsService;

class VitalsEditorService
{
    /** Editable fields, in display order. All metric (module convention). */
    private const FIELDS = [
        'bps', 'bpd', 'pulse', 'respiration', 'temperature',
        'oxygen_saturation', 'weight', 'height', 'waist_circ', 'note',
    ];

    /** States in which a clinician may record vitals on a visit. */
    private const CLINICAL_STATES = [
        'awaiting_triage', 'in_triage', 'with_doctor',
        'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
    ];

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VitalsValidationService $validation = new VitalsValidationService(),
    ) {
    }

    /**
     * Bootstrap payload: field meta + the latest vitals set on the encounter.
     *
     * @return array<string, mixed>
     */
    public function getVitals(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatest($pid, $encounter);

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'vitals_id' => $existing['id'] ?? null,
            'values' => $existing['values'] ?? new \stdClass(),
            'saved' => $existing !== null,
            'locked' => $this->isSigned($encounter, $pid),
            'fields' => $this->fieldMeta(),
        ];
    }

    /**
     * Save the encounter's vitals: update the loaded set in place, or create a
     * new one. Values arrive metric; BMI/BMI_status are recomputed server-side.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveVitals(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visitId = (int) ($body['visit_id'] ?? 0);
        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter yet');
        }
        // E-sign is compliance, never optional: a signed vitals form must not be
        // silently edited — it needs the unlock/amend flow first.
        if ($this->isSigned($encounter, $pid)) {
            throw new \RuntimeException('This vitals record is signed — unlock the encounter to amend it', 409);
        }

        $raw = is_array($body['values'] ?? null) ? $body['values'] : [];
        $input = [];
        foreach (self::FIELDS as $field) {
            if (array_key_exists($field, $raw) && $raw[$field] !== '' && $raw[$field] !== null) {
                $input[$field] = $field === 'note'
                    ? mb_substr(trim((string) $raw[$field]), 0, 255)
                    : $raw[$field];
            }
        }

        $note = $input['note'] ?? null;
        unset($input['note']);

        $validated = $this->validation->validateForTriage($input);
        if (!empty($validated['errors'])) {
            throw new VitalsValidationException(
                $validated['errors'],
                $validated['field_errors'],
                $validated['field_warnings']
            );
        }

        $payload = $validated['payload'];
        if ($note !== null) {
            $payload['note'] = $note;
        }

        // waist_circ is not one of the shared validator's fields — it silently
        // drops it. Validate and merge it here (cm).
        if (isset($input['waist_circ'])) {
            if (!is_numeric($input['waist_circ'])) {
                throw new \InvalidArgumentException('Waist must be numeric');
            }
            $waist = (float) $input['waist_circ'];
            if ($waist < 20 || $waist > 300) {
                throw new \InvalidArgumentException('Waist must be between 20 and 300');
            }
            $payload['waist_circ'] = $waist;
        }

        $bmi = $this->computeBmi($payload);
        if ($bmi !== null) {
            $payload['BMI'] = $bmi['value'];
            $payload['BMI_status'] = $bmi['status'];
        }

        $vitalsId = (int) ($body['vitals_id'] ?? 0);
        if ($vitalsId > 0) {
            $this->assertVitalsOnEncounter($vitalsId, $pid, $encounter);
            $payload['id'] = $vitalsId;
            $payload['pid'] = $pid;
            $payload['eid'] = $encounter;
            $payload['authorized'] = '1';
            // The FHIR uuid-mapping post-save listener requires the record uuid
            // in the payload on update — without it the listener inserts a NULL
            // target_uuid and the whole save dies.
            $uuidBin = QueryUtils::fetchSingleValue(
                'SELECT uuid FROM form_vitals WHERE id = ?',
                'uuid',
                [$vitalsId]
            );
            if (!empty($uuidBin)) {
                $payload['uuid'] = UuidRegistry::uuidToString($uuidBin);
            }
            // saveVitalsArray (not save()): the FormVitals whitelist in save()
            // drops `uuid`, and the FHIR post-save listener then dies on a NULL
            // target_uuid. Our payload is already whitelisted to FIELDS.
            (new VitalsService())->saveVitalsArray($payload);
            // Touch the forms registry date so the card's "Last saved" reflects
            // this edit (the update path doesn't do it).
            QueryUtils::sqlStatementThrowException(
                "UPDATE forms SET date = NOW() WHERE form_id = ? AND encounter = ? AND pid = ? AND formdir = 'vitals'",
                [$vitalsId, $encounter, $pid]
            );
        } else {
            [$vitalsId] = (new EncounterService())->insertVital($pid, $encounter, $payload);
            $vitalsId = (int) $vitalsId;
        }

        return [
            'saved' => true,
            'vitals_id' => $vitalsId,
            'bmi' => $bmi['value'] ?? null,
            'bmi_status' => $bmi['status'] ?? null,
            'warnings' => $validated['warnings'] ?? [],
        ];
    }

    /**
     * Latest non-deleted vitals set on the encounter, values in module units
     * (weight kg / height cm raw; temperature converted to °C for the form).
     *
     * @return array{id: int, values: array<string, mixed>}|null
     */
    private function loadLatest(int $pid, int $encounter): ?array
    {
        if ($encounter <= 0) {
            return null;
        }

        $row = QueryUtils::fetchRecords(
            "SELECT v.id, v.bps, v.bpd, v.pulse, v.respiration, v.temperature,
                    v.oxygen_saturation, v.weight, v.height, v.waist_circ, v.note
             FROM forms f
             JOIN form_vitals v ON v.id = f.form_id
             WHERE f.encounter = ? AND f.pid = ? AND f.formdir = 'vitals' AND f.deleted = 0
             ORDER BY f.date DESC
             LIMIT 1",
            [$encounter, $pid]
        );

        if (empty($row[0])) {
            return null;
        }

        $values = [];
        foreach (self::FIELDS as $field) {
            $value = $row[0][$field] ?? null;
            if ($value === null || $value === '' || (is_numeric($value) && (float) $value == 0.0 && $field !== 'note')) {
                continue;
            }
            if ($field === 'temperature') {
                $value = $this->validation->temperatureForEvaluation((float) $value);
            }
            $values[$field] = is_numeric($value) ? round((float) $value, 1) : $value;
        }

        return [
            'id' => (int) $row[0]['id'],
            'values' => $values,
        ];
    }

    /**
     * @param array<string, mixed> $payload storage payload (weight kg, height cm)
     * @return array{value: float, status: string}|null
     */
    private function computeBmi(array $payload): ?array
    {
        $weight = isset($payload['weight']) ? (float) $payload['weight'] : 0.0;
        $height = isset($payload['height']) ? (float) $payload['height'] : 0.0;
        if ($weight <= 0 || $height <= 0) {
            return null;
        }

        $metres = $height / 100;
        $bmi = round($weight / ($metres * $metres), 1);
        $status = match (true) {
            $bmi < 18.5 => 'Underweight',
            $bmi < 25 => 'Normal',
            $bmi < 30 => 'Overweight',
            default => 'Obese',
        };

        return ['value' => $bmi, 'status' => $status];
    }

    /**
     * Field metadata for the drawer (labels, units, hard ranges, normal ranges,
     * required set) — single source of truth is the validation service.
     *
     * @return array<string, mixed>
     */
    private function fieldMeta(): array
    {
        return [
            'required' => ['bps', 'bpd', 'pulse', 'temperature', 'weight'],
            'units' => [
                'bps' => 'mmHg', 'bpd' => 'mmHg', 'pulse' => 'bpm',
                'respiration' => '/min', 'temperature' => '°C',
                'oxygen_saturation' => '%', 'weight' => 'kg',
                'height' => 'cm', 'waist_circ' => 'cm',
            ],
            'labels' => [
                'bps' => 'BP systolic', 'bpd' => 'BP diastolic', 'pulse' => 'Pulse',
                'respiration' => 'Resp. rate', 'temperature' => 'Temperature',
                'oxygen_saturation' => 'SpO₂', 'weight' => 'Weight',
                'height' => 'Height', 'waist_circ' => 'Waist', 'note' => 'Note',
            ],
        ];
    }

    /** Instantiated at call time (not in the constructor) — crash-pattern rule. */
    private function isSigned(int $encounter, int $pid): bool
    {
        if ($encounter <= 0) {
            return false;
        }

        return (new EncounterSignService())->isFormdirSignedOnEncounter($encounter, $pid, 'vitals');
    }

    private function assertVitalsOnEncounter(int $vitalsId, int $pid, int $encounter): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT f.id FROM forms f
             WHERE f.form_id = ? AND f.encounter = ? AND f.pid = ? AND f.formdir = 'vitals' AND f.deleted = 0
             LIMIT 1",
            [$vitalsId, $encounter, $pid]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Vitals set is not on this visit');
        }
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

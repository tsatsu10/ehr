<?php

/**
 * Referral correspondence read models (M11-F08 / CDb façade)
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

class ReferralCorrespondenceService
{
    public const PAGE_SIZE = 20;

    /** @var array<int, string> M11-F03 status model (§10.6, D-REF-1) */
    public const REFERRAL_STATUSES = ['draft', 'printed', 'given', 'result_received'];

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getClinicalStrip(int $pid, ?int $encounterId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $encounterId = $this->resolveEncounterId($pid, $encounterId);

        if (!$this->isReferralStripEnabled($facilityId) || $encounterId <= 0) {
            return $this->hiddenStripPayload($webroot, $pid, $encounterId);
        }

        $visitDate = $this->resolveVisitDateForEncounter($pid, $encounterId);
        $items = $this->fetchReferralItems($pid, $visitDate, 5);
        $canManage = AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral');
        $canOpen = $canManage || AclMain::aclCheckCore('new_clinic', 'new_chart_depth');
        $hubUrl = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?pid='
            . urlencode((string) $pid)
            . '&encounter_id='
            . urlencode((string) $encounterId);

        return [
            // Show the strip whenever the user can open the hub — even with zero
            // referrals on file — so the "Open referrals" entry point is never
            // stranded. It is the only Clinical-tab path to create the first
            // referral (and, when letters are on, the first letter), exactly the
            // case where the old `$items === []` gate hid it. Same reachability
            // rule as the Visits-tab link (buildVisitReferralsUrl): enabled + ACL,
            // not referral history. Only truly hidden when there is nothing to
            // show AND nowhere to go.
            'hidden' => $items === [] && !$canOpen,
            'encounter_id' => $encounterId,
            'items' => $items,
            'has_active_draft' => $this->hasDraftItem($items),
            'can_open_referrals' => $canOpen,
            'can_create_referral' => $canManage,
            'open_referrals_url' => $canOpen ? $hubUrl : null,
            'stock_transactions_url' => $webroot
                . '/interface/patient_file/transaction/transactions.php?set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getReferralsList(
        int $pid,
        int $offset = 0,
        int $limit = self::PAGE_SIZE,
        ?int $encounterId = null
    ): array {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertReferralEnabled();

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $visitDate = null;
        if ($encounterId !== null && $encounterId > 0) {
            $visitDate = $this->resolveVisitDateForEncounter($pid, $encounterId);
        }

        $total = $this->countReferrals($pid, $visitDate);
        $items = $this->fetchReferralItems($pid, $visitDate, $limit, $offset);
        $webroot = $GLOBALS['webroot'] ?? '';
        $canManage = AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral');
        $nativeEditor = $this->isNativeEditorEnabled();

        // D-REF-8 — identity line for the print confirm (Patient · MRN).
        $patientRow = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid FROM patient_data WHERE pid = ?',
            [$pid]
        );
        $patientLabel = is_array($patientRow)
            ? trim((string) ($patientRow['lname'] ?? '') . ', ' . (string) ($patientRow['fname'] ?? ''), ', ')
                . ((string) ($patientRow['pubpid'] ?? '') !== '' ? ' · MRN ' . (string) $patientRow['pubpid'] : '')
            : '';

        return [
            'pid' => $pid,
            'patient_label' => $patientLabel,
            'encounter_id' => $encounterId,
            'items' => array_map(function (array $item) use ($webroot, $canManage, $nativeEditor): array {
                $transactionId = (int) ($item['transaction_id'] ?? 0);
                // CP-1 — native editor flag ON: edit opens the drawer (no stock
                // URL) and print uses the native parity page. Flag OFF: exactly
                // the stock links as before (PRD §5.6).
                $item['print_url'] = $canManage
                    ? ($nativeEditor
                        ? self::nativePrintUrl($webroot, $transactionId)
                        : $webroot . '/interface/patient_file/transaction/print_referral.php?transid='
                            . urlencode((string) $transactionId))
                    : null;
                $item['can_native_edit'] = $canManage && $nativeEditor;
                $item['edit_url'] = ($canManage && !$nativeEditor)
                    ? $webroot . '/interface/patient_file/transaction/add_transaction.php?transid='
                        . urlencode((string) $transactionId)
                        . '&title=LBTref&inmode=edit'
                    : null;

                return $item;
            }, $items),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($items)) < $total,
            'can_create_referral' => $canManage,
            'create_referral_url' => $canManage
                ? $webroot . '/interface/patient_file/transaction/add_transaction.php?title=LBTref'
                : null,
        ];
    }

    /** CP-1 — facility-scoped native referral editor/print flag. */
    public function isNativeEditorEnabled(): bool
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        return $this->config->getInt('enable_native_referral_editor', 0, $facilityId) === 1;
    }

    private static function nativePrintUrl(string $webroot, int $transactionId): string
    {
        return $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referral-print.php?transid='
            . urlencode((string) $transactionId);
    }

    /**
     * M11-F03 — referral wizard save. Writes stock `transactions` + `lbt_data`
     * plus a `new_referral_meta` status row (D-REF-1 façade — no engine fork).
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveReferral(array $body, int $actorUserId): array
    {
        $pid = (int) ($body['pid'] ?? 0);
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient id is required');
        }
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertReferralEnabled();
        $this->assertCanManage();

        $destination = trim((string) ($body['destination_facility'] ?? ''));
        if ($destination === '') {
            throw new \InvalidArgumentException('Destination facility is required');
        }
        $summary = trim((string) ($body['summary'] ?? ''));
        if ($summary === '') {
            throw new \InvalidArgumentException('Clinical summary is required');
        }

        $department = trim((string) ($body['destination_department'] ?? ''));
        $diagnosis = trim((string) ($body['diagnosis'] ?? ''));
        $chiefComplaint = trim((string) ($body['chief_complaint'] ?? ''));
        $encounterId = (int) ($body['encounter_id'] ?? 0);
        $visitId = (int) ($body['visit_id'] ?? 0);
        // D-REF-9 / G12 — a wizard launched from "This visit" must reference an
        // encounter that belongs to this patient; anything else is a wrong-patient risk.
        if ($encounterId > 0) {
            $owned = QueryUtils::querySingleRow(
                'SELECT encounter FROM form_encounter WHERE encounter = ? AND pid = ?',
                [$encounterId, $pid]
            );
            if (!is_array($owned)) {
                throw new \InvalidArgumentException('Encounter does not belong to this patient');
            }
        }
        $referDate = date('Y-m-d');

        $referTo = $department !== '' ? $destination . ' — ' . $department : $destination;
        $bodyText = implode("\n", array_filter([
            $chiefComplaint !== '' ? 'Chief complaint: ' . $chiefComplaint : null,
            $diagnosis !== '' ? 'Diagnosis: ' . $diagnosis : null,
            $summary,
        ]));

        $transactionId = QueryUtils::sqlInsert(
            "INSERT INTO transactions (date, title, pid, user, groupname, authorized)
             VALUES (NOW(), 'LBTref', ?, ?, ?, 1)",
            [$pid, $_SESSION['authUser'] ?? '', $_SESSION['authProvider'] ?? 'Default']
        );

        foreach ([
            'refer_date' => $referDate,
            'refer_to' => $referTo,
            'body' => $bodyText,
        ] as $fieldId => $fieldValue) {
            QueryUtils::sqlStatementThrowException(
                'INSERT INTO lbt_data (form_id, field_id, field_value) VALUES (?, ?, ?)',
                [$transactionId, $fieldId, $fieldValue]
            );
        }

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO new_referral_meta
                (transaction_id, pid, encounter_id, visit_id, status,
                 destination_facility, destination_department, created_by)
             VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)",
            [
                $transactionId,
                $pid,
                $encounterId > 0 ? $encounterId : null,
                $visitId > 0 ? $visitId : null,
                $destination,
                $department !== '' ? $department : null,
                $actorUserId,
            ]
        );

        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'transaction_id' => (int) $transactionId,
            'status' => 'draft',
            'print_url' => $this->isNativeEditorEnabled()
                ? self::nativePrintUrl($webroot, (int) $transactionId)
                : $webroot
                    . '/interface/patient_file/transaction/print_referral.php?transid='
                    . urlencode((string) $transactionId),
        ];
    }

    /**
     * M11-F03/F04 — mark printed + audit; returns the stock print URL.
     *
     * @return array<string, mixed>
     */
    public function printReferral(int $transactionId, int $actorUserId): array
    {
        $this->assertReferralEnabled();
        $this->assertCanManage();
        $referral = $this->loadReferralTransaction($transactionId);
        $this->facilityScope->assertPatientAccessible((int) $referral['pid']);

        $meta = $this->loadMeta($transactionId);
        if ($meta === null || $meta['status'] === 'draft') {
            $this->upsertMetaStatus($transactionId, (int) $referral['pid'], 'printed', null, $actorUserId);
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.referral_printed transaction_id=' . $transactionId
            . ' pid=' . (int) $referral['pid']
        );

        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'transaction_id' => $transactionId,
            'status' => $this->loadMeta($transactionId)['status'] ?? 'printed',
            'print_url' => $this->isNativeEditorEnabled()
                ? self::nativePrintUrl($webroot, $transactionId)
                : $webroot
                    . '/interface/patient_file/transaction/print_referral.php?transid='
                    . urlencode((string) $transactionId),
        ];
    }

    /**
     * M11-F04 — status transitions: printed → given → result_received
     * (result may attach a scanned document id).
     *
     * @return array<string, mixed>
     */
    public function updateReferralStatus(
        int $transactionId,
        string $status,
        ?int $resultDocumentId,
        int $actorUserId
    ): array {
        $this->assertReferralEnabled();
        $this->assertCanManage();
        if (!in_array($status, self::REFERRAL_STATUSES, true)) {
            throw new \InvalidArgumentException('Unknown referral status');
        }

        $referral = $this->loadReferralTransaction($transactionId);
        $this->facilityScope->assertPatientAccessible((int) $referral['pid']);

        $this->upsertMetaStatus(
            $transactionId,
            (int) $referral['pid'],
            $status,
            $status === 'result_received' ? $resultDocumentId : null,
            $actorUserId
        );

        return [
            'transaction_id' => $transactionId,
            'status' => $status,
        ];
    }

    /**
     * CP-1 — editable LBTref working set for the native drawer. Mirrors the
     * stock add_transaction.php field semantics (values live in lbt_data).
     * Deliberately excludes refer_from / refer_external / refer_vitals /
     * refer_related_code / billing_facility_id — rarely used here; the stock
     * form remains reachable via the "Advanced (stock form)" escape.
     *
     * @var array<string, int> field_id => max length
     */
    private const EDITOR_FIELDS = [
        'refer_date' => 10,
        'refer_to' => 255,
        'refer_diag' => 255,
        'refer_risk_level' => 31,
        'body' => 4000,
        'reply_date' => 10,
        'reply_init_diag' => 255,
        'reply_final_diag' => 255,
        'reply_findings' => 4000,
        'reply_services' => 4000,
        'reply_recommend' => 4000,
    ];

    /**
     * CP-1 — native editor read model: current LBTref values + risk options.
     *
     * @return array<string, mixed>
     */
    public function getReferralEditor(int $transactionId): array
    {
        $this->assertReferralEnabled();
        $this->assertCanManage();
        if (!$this->isNativeEditorEnabled()) {
            throw new \RuntimeException('Native referral editor is not enabled', 403);
        }

        $referral = $this->loadReferralTransaction($transactionId);
        $pid = (int) $referral['pid'];
        $this->facilityScope->assertPatientAccessible($pid);

        $values = $this->loadEditorValues($transactionId);

        $meta = QueryUtils::querySingleRow(
            'SELECT status, destination_facility, destination_department
             FROM new_referral_meta WHERE transaction_id = ? LIMIT 1',
            [$transactionId]
        );

        return [
            'transaction_id' => $transactionId,
            'pid' => $pid,
            'fields' => $values,
            // Optimistic-concurrency token: the drawer sends this back on save so
            // a stale edit can't silently overwrite someone else's change.
            'fingerprint' => self::editorFingerprint($values),
            'has_meta' => is_array($meta),
            'status' => is_array($meta) ? (string) ($meta['status'] ?? 'draft') : null,
            'risk_levels' => $this->riskLevelOptions(),
        ];
    }

    /**
     * Deterministic token over the editable field values (fixed EDITOR_FIELDS
     * order). Public static so the concurrency contract is unit-testable.
     *
     * @param array<string, string> $values
     */
    public static function editorFingerprint(array $values): string
    {
        $ordered = [];
        foreach (array_keys(self::EDITOR_FIELDS) as $fieldId) {
            $ordered[$fieldId] = (string) ($values[$fieldId] ?? '');
        }

        return sha1((string) json_encode($ordered));
    }

    /**
     * CP-1 — native editor save: upserts the whitelisted LBTref fields in
     * lbt_data (REPLACE semantics, matching stock add_transaction.php) and
     * keeps new_referral_meta's destination in step when refer_to changes.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function updateReferral(int $transactionId, array $body, int $actorUserId): array
    {
        $this->assertReferralEnabled();
        $this->assertCanManage();
        if (!$this->isNativeEditorEnabled()) {
            throw new \RuntimeException('Native referral editor is not enabled', 403);
        }

        $referral = $this->loadReferralTransaction($transactionId);
        $pid = (int) $referral['pid'];
        $this->facilityScope->assertPatientAccessible($pid);

        $fields = is_array($body['fields'] ?? null) ? $body['fields'] : [];
        $clean = self::validateEditorFields($fields, $this->riskLevelOptionIds());
        if ($clean === []) {
            throw new \InvalidArgumentException('Nothing to save');
        }
        if (array_key_exists('refer_to', $clean) && trim($clean['refer_to']) === '') {
            throw new \InvalidArgumentException('Refer to is required');
        }

        // Optimistic concurrency: when the drawer sends the fingerprint it loaded,
        // refuse with 409 if the referral changed underneath (same pattern as the
        // pharmacy stock adjust). The drawer keeps the user's typing and lets them
        // decide, so nothing is silently overwritten OR silently lost.
        $expectedFingerprint = trim((string) ($body['expected_fingerprint'] ?? ''));
        if ($expectedFingerprint !== '') {
            $currentFingerprint = self::editorFingerprint($this->loadEditorValues($transactionId));
            if (!hash_equals($currentFingerprint, $expectedFingerprint)) {
                throw new \RuntimeException(
                    'This referral was changed by someone else while you were editing.',
                    409
                );
            }
        }

        // One transaction so a mid-loop failure can't leave a half-edited
        // referral (fields + meta move together).
        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';
        sqlBeginTrans();
        $committed = false;
        try {
            foreach ($clean as $fieldId => $value) {
                QueryUtils::sqlStatementThrowException(
                    'REPLACE INTO lbt_data (form_id, field_id, field_value) VALUES (?, ?, ?)',
                    [$transactionId, $fieldId, $value]
                );
            }

            // Keep the wizard's meta destination readable in the hub list when the
            // free-text refer_to is edited ("Facility — Department" convention).
            if (array_key_exists('refer_to', $clean)) {
                $parts = array_map('trim', explode('—', $clean['refer_to'], 2));
                QueryUtils::sqlStatementThrowException(
                    'UPDATE new_referral_meta
                     SET destination_facility = ?, destination_department = ?
                     WHERE transaction_id = ?',
                    [
                        $parts[0] !== '' ? mb_substr($parts[0], 0, 255) : null,
                        isset($parts[1]) && $parts[1] !== '' ? mb_substr($parts[1], 0, 128) : null,
                        $transactionId,
                    ]
                );
            }

            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.referral_updated transaction_id=' . $transactionId
            . ' pid=' . $pid
            . ' fields=' . implode(',', array_keys($clean))
        );

        return [
            'transaction_id' => $transactionId,
            'saved_fields' => array_keys($clean),
        ];
    }

    /**
     * Pure validation for the editor save — visible for unit tests.
     *
     * @param array<string, mixed> $fields
     * @param array<int, string> $validRiskIds
     * @return array<string, string> whitelisted field_id => trimmed value
     */
    public static function validateEditorFields(array $fields, array $validRiskIds): array
    {
        $clean = [];
        foreach (self::EDITOR_FIELDS as $fieldId => $maxLen) {
            if (!array_key_exists($fieldId, $fields)) {
                continue;
            }
            $value = trim((string) $fields[$fieldId]);
            if (mb_strlen($value) > $maxLen) {
                throw new \InvalidArgumentException('Value too long for ' . $fieldId);
            }
            if (in_array($fieldId, ['refer_date', 'reply_date'], true) && $value !== '') {
                $parsed = \DateTime::createFromFormat('Y-m-d', $value);
                if (!$parsed || $parsed->format('Y-m-d') !== $value) {
                    throw new \InvalidArgumentException('Invalid date for ' . $fieldId);
                }
            }
            if ($fieldId === 'refer_risk_level' && $value !== '' && !in_array($value, $validRiskIds, true)) {
                throw new \InvalidArgumentException('Unknown risk level');
            }
            $clean[$fieldId] = $value;
        }

        return $clean;
    }

    /**
     * Current editable field values from the lbt_data pivot (blank-filled).
     *
     * @return array<string, string>
     */
    private function loadEditorValues(int $transactionId): array
    {
        $values = array_fill_keys(array_keys(self::EDITOR_FIELDS), '');
        $rows = QueryUtils::fetchRecords(
            'SELECT field_id, field_value FROM lbt_data WHERE form_id = ?',
            [$transactionId]
        ) ?: [];
        foreach ($rows as $row) {
            $fieldId = (string) ($row['field_id'] ?? '');
            if (array_key_exists($fieldId, self::EDITOR_FIELDS)) {
                $values[$fieldId] = (string) ($row['field_value'] ?? '');
            }
        }

        return $values;
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    private function riskLevelOptions(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options
             WHERE list_id = 'risklevel' AND activity = 1
             ORDER BY seq, title",
            []
        ) ?: [];

        return array_map(static fn (array $row): array => [
            'value' => (string) ($row['option_id'] ?? ''),
            'label' => (string) ($row['title'] ?? ''),
        ], $rows);
    }

    /**
     * @return array<int, string>
     */
    private function riskLevelOptionIds(): array
    {
        return array_map(static fn (array $opt): string => $opt['value'], $this->riskLevelOptions());
    }

    protected function assertCanManage(): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function loadReferralTransaction(int $transactionId): array
    {
        if ($transactionId <= 0) {
            throw new \InvalidArgumentException('Referral id is required');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT id, pid FROM transactions WHERE id = ? AND title = 'LBTref' LIMIT 1",
            [$transactionId]
        );
        if (!is_array($row)) {
            throw new \RuntimeException('Referral not found', 404);
        }

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadMeta(int $transactionId): ?array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT status, result_document_id FROM new_referral_meta WHERE transaction_id = ? LIMIT 1',
            [$transactionId]
        );

        return is_array($row) ? $row : null;
    }

    private function upsertMetaStatus(
        int $transactionId,
        int $pid,
        string $status,
        ?int $resultDocumentId,
        int $actorUserId
    ): void {
        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_referral_meta (transaction_id, pid, status, result_document_id, created_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status),
                 result_document_id = COALESCE(VALUES(result_document_id), result_document_id)',
            [$transactionId, $pid, $status, $resultDocumentId, $actorUserId]
        );
    }

    /** Memoized per request — the gate is identical for every visit row. */
    private ?bool $canLinkVisitReferrals = null;

    /**
     * §503 / REF-4 — Visits-row "Referrals for this visit" deep link into the
     * hub filtered by encounter; null when CDb is off or the user cannot view.
     */
    public function buildVisitReferralsUrl(int $pid, int $encounterId): ?string
    {
        if ($encounterId <= 0) {
            return null;
        }
        if ($this->canLinkVisitReferrals === null) {
            $facilityId = $this->visitScope->resolveDefaultFacilityId();
            $this->canLinkVisitReferrals = $this->isReferralStripEnabled($facilityId)
                && (
                    AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')
                    || AclMain::aclCheckCore('new_clinic', 'new_chart_depth')
                );
        }
        if (!$this->canLinkVisitReferrals) {
            return null;
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?pid='
            . urlencode((string) $pid)
            . '&encounter_id='
            . urlencode((string) $encounterId);
    }

    private function isReferralStripEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_chart_depth', 0, $facilityId) === 1
            && $this->config->getInt('enable_chart_depth_referral', 0, $facilityId) === 1;
    }

    protected function assertReferralEnabled(): void
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if (!$this->isReferralStripEnabled($facilityId)) {
            throw new \RuntimeException('Chart depth referrals are not enabled', 403);
        }
    }

    private function resolveEncounterId(int $pid, ?int $encounterId): int
    {
        return $this->visitScope->resolveActiveEncounterId($pid, $encounterId);
    }

    private function resolveVisitDateForEncounter(int $pid, int $encounterId): ?string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT visit_date FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );

        if (!is_array($row)) {
            return null;
        }

        $date = (string) ($row['visit_date'] ?? '');

        return $date !== '' && $date !== '0000-00-00' ? $date : null;
    }

    private function countReferrals(int $pid, ?string $visitDate): int
    {
        $bind = [$pid];
        $dateFilter = $this->buildVisitDateFilter($visitDate, $bind);

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT t.id) AS cnt
             FROM transactions t
             WHERE t.pid = ? AND t.title = 'LBTref'{$dateFilter}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchReferralItems(int $pid, ?string $visitDate, int $limit, int $offset = 0): array
    {
        $bind = [$pid];
        $dateFilter = $this->buildVisitDateFilter($visitDate, $bind);

        $rows = QueryUtils::fetchRecords(
            "SELECT t.id, t.date, t.user,
                    MAX(CASE WHEN ld.field_id = 'refer_to' THEN ld.field_value END) AS refer_to,
                    MAX(CASE WHEN ld.field_id = 'refer_date' THEN ld.field_value END) AS refer_date,
                    MAX(CASE WHEN ld.field_id = 'body' THEN ld.field_value END) AS body,
                    MAX(meta.status) AS meta_status,
                    MAX(meta.result_document_id) AS result_document_id
             FROM transactions t
             LEFT JOIN lbt_data ld ON ld.form_id = t.id
             LEFT JOIN new_referral_meta meta ON meta.transaction_id = t.id
             WHERE t.pid = ? AND t.title = 'LBTref'{$dateFilter}
             GROUP BY t.id, t.date, t.user
             ORDER BY COALESCE(MAX(CASE WHEN ld.field_id = 'refer_date' THEN ld.field_value END), t.date) DESC,
                      t.id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapReferralRow($row), $rows);
    }

    /**
     * @param array<int, mixed> $bind
     */
    private function buildVisitDateFilter(?string $visitDate, array &$bind): string
    {
        if ($visitDate === null || $visitDate === '') {
            return '';
        }

        $bind[] = $visitDate;
        $bind[] = $visitDate;

        return " AND (
            EXISTS (
                SELECT 1 FROM lbt_data ld2
                WHERE ld2.form_id = t.id AND ld2.field_id = 'refer_date' AND ld2.field_value = ?
            )
            OR DATE(t.date) = ?
        )";
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapReferralRow(array $row): array
    {
        $referTo = trim((string) ($row['refer_to'] ?? ''));
        $body = trim((string) ($row['body'] ?? ''));
        $label = $referTo !== '' ? $referTo : ($body !== '' ? $this->clipText($body, 60) : 'Referral');

        // Meta status (M11-F03 wizard rows) wins; legacy rows keep the heuristic.
        $metaStatus = trim((string) ($row['meta_status'] ?? ''));
        $statusLabels = [
            'draft' => 'Draft',
            'printed' => 'Printed',
            'given' => 'Given to patient',
            'result_received' => 'Result received',
        ];
        $status = $statusLabels[$metaStatus] ?? ($referTo === '' ? 'Draft' : 'Issued');

        $occurredAt = trim((string) ($row['refer_date'] ?? ''));
        if ($occurredAt === '' || $occurredAt === '0000-00-00') {
            $occurredAt = (string) ($row['date'] ?? '');
        }

        return [
            'transaction_id' => (int) ($row['id'] ?? 0),
            'label' => $label,
            'status' => $status,
            'status_key' => $metaStatus !== '' ? $metaStatus : null,
            'result_document_id' => !empty($row['result_document_id'])
                ? (int) $row['result_document_id']
                : null,
            'occurred_at' => $this->formatDate($occurredAt),
            'author' => trim((string) ($row['user'] ?? '')),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function hasDraftItem(array $items): bool
    {
        foreach ($items as $item) {
            if (($item['status'] ?? '') === 'Draft') {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function hiddenStripPayload(string $webroot, int $pid, int $encounterId): array
    {
        return [
            'hidden' => true,
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'items' => [],
            'has_active_draft' => false,
            'can_open_referrals' => false,
            'can_create_referral' => false,
            'open_referrals_url' => null,
            'stock_transactions_url' => $webroot
                . '/interface/patient_file/transaction/transactions.php?set_pid='
                . urlencode((string) $pid),
        ];
    }

    private function clipText(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }

    private function formatDate(?string $date): ?string
    {
        if (empty($date) || str_starts_with((string) $date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}

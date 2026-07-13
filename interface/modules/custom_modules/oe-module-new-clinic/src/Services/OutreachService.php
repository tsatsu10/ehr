<?php

/**
 * Batch outreach campaigns (GAP-B B1, closes G6).
 *
 * Cohort → compose → dry-run preview → queue. Audience resolution reuses the
 * registry cohort search (same filters/presets); reachability and the recorded
 * campaign are computed here. A **dry-run preview is mandatory** in the UX, and
 * queue() itself always resolves+reports the reachable set before recording.
 * Delivery goes through the OutreachGateway port — V1 ships only the stub, so
 * campaigns are recorded as intent and nothing is actually sent yet.
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
use OpenEMR\Modules\NewClinic\Services\Outreach\OutreachGatewayFactory;

class OutreachService
{
    /** @var array<int, string> */
    public const CHANNELS = ['sms', 'email'];

    /** Slice-1 bound on recipients resolved per campaign (R2 — bounded query). */
    private const MAX_RECIPIENTS = 500;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly PatientCohortSearchService $cohort = new PatientCohortSearchService(),
    ) {
    }

    private function assertEnabled(): void
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if ($this->config->getInt('enable_outreach', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Outreach is not enabled for this clinic', 403);
        }
        if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            throw new \RuntimeException('Outreach access denied', 403);
        }
    }

    /**
     * Cohort presets for the audience picker (reused from the registry).
     *
     * @return array<string, mixed>
     */
    public function presets(): array
    {
        $this->assertEnabled();

        return ['presets' => $this->cohort->presets(), 'gateway_configured' => OutreachGatewayFactory::create()->isConfigured()];
    }

    /**
     * Mandatory dry-run: how many patients match, how many are reachable on the
     * chosen channel, a sample, and the cohort description.
     *
     * @param array<string, mixed> $request
     * @return array<string, mixed>
     */
    public function preview(array $request): array
    {
        $this->assertEnabled();
        $channel = $this->normalizeChannel((string) ($request['channel'] ?? 'sms'));
        $filters = is_array($request['filters'] ?? null) ? $request['filters'] : [];

        $resolved = $this->resolveRecipients($filters, $channel);

        return [
            'channel' => $channel,
            'recipient_count' => $resolved['total'],
            'reachable_count' => $resolved['reachable_count'],
            'capped' => $resolved['capped'],
            'cap' => self::MAX_RECIPIENTS,
            'filter_summary' => $resolved['filter_summary'],
            'sample' => array_map(
                static fn (array $r): array => ['name' => $r['name'], 'contact' => $r['contact']],
                array_slice($resolved['reachable'], 0, 10)
            ),
        ];
    }

    /**
     * Record + (attempt to) send a campaign. Nothing is sent while only the stub
     * gateway is wired; the campaign is logged either way.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function queue(array $body, int $actorUserId): array
    {
        $this->assertEnabled();
        $channel = $this->normalizeChannel((string) ($body['channel'] ?? 'sms'));
        $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
        $subject = trim((string) ($body['subject'] ?? ''));
        $messageBody = trim((string) ($body['body'] ?? ''));

        if ($messageBody === '') {
            throw new \InvalidArgumentException('A message body is required.');
        }
        if (mb_strlen($messageBody) > 2000) {
            throw new \InvalidArgumentException('Message body is too long.');
        }
        if ($channel === 'email' && $subject === '') {
            throw new \InvalidArgumentException('An email subject is required.');
        }

        $resolved = $this->resolveRecipients($filters, $channel);
        if ($resolved['reachable_count'] === 0) {
            throw new \InvalidArgumentException('No recipients in this cohort are reachable by ' . $channel . '.');
        }

        $result = OutreachGatewayFactory::create()->send($channel, $subject, $messageBody, $resolved['reachable']);
        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        QueryUtils::sqlInsert(
            "INSERT INTO new_outreach_campaign
                (facility_id, channel, subject, body, filter_json, filter_summary,
                 recipient_count, reachable_count, status, delivery_note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $facilityId,
                $channel,
                $subject !== '' ? $subject : null,
                $messageBody,
                json_encode($filters),
                $resolved['filter_summary'],
                $resolved['total'],
                $resolved['reachable_count'],
                (string) $result['status'],
                (string) $result['note'],
                $actorUserId,
            ]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'outreach',
            $actorUserId,
            1,
            'outreach.queued channel=' . $channel
            . ' reachable=' . $resolved['reachable_count']
            . ' status=' . $result['status']
        );

        return [
            'status' => $result['status'],
            'note' => $result['note'],
            'recipient_count' => $resolved['total'],
            'reachable_count' => $resolved['reachable_count'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function history(): array
    {
        $this->assertEnabled();
        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        $rows = QueryUtils::fetchRecords(
            "SELECT id, channel, subject, filter_summary, recipient_count, reachable_count,
                    status, delivery_note, created_at
             FROM new_outreach_campaign
             WHERE facility_id = ?
             ORDER BY created_at DESC
             LIMIT 50",
            [$facilityId]
        ) ?: [];

        return [
            'campaigns' => array_map(static function (array $row): array {
                return [
                    'id' => (int) ($row['id'] ?? 0),
                    'channel' => (string) ($row['channel'] ?? ''),
                    'subject' => (string) ($row['subject'] ?? ''),
                    'filter_summary' => (string) ($row['filter_summary'] ?? ''),
                    'recipient_count' => (int) ($row['recipient_count'] ?? 0),
                    'reachable_count' => (int) ($row['reachable_count'] ?? 0),
                    'status' => (string) ($row['status'] ?? ''),
                    'delivery_note' => (string) ($row['delivery_note'] ?? ''),
                    'created_at' => (string) ($row['created_at'] ?? ''),
                ];
            }, $rows),
        ];
    }

    private function normalizeChannel(string $channel): string
    {
        $channel = strtolower(trim($channel));

        return in_array($channel, self::CHANNELS, true) ? $channel : 'sms';
    }

    /**
     * Resolve the cohort to reachable recipients for a channel. Cohort matching
     * reuses the registry search (filters + count + human summary); real contact
     * details come from a bounded supplementary query (search only exposes a
     * masked phone).
     *
     * @param array<string, mixed> $filters
     * @return array{total: int, reachable: array<int, array{pid: int, name: string, contact: string}>, reachable_count: int, capped: bool, filter_summary: string}
     */
    private function resolveRecipients(array $filters, string $channel): array
    {
        $search = $this->cohort->search([
            'filters' => $filters,
            'page' => 1,
            'page_size' => self::MAX_RECIPIENTS,
            'sort' => 'name_asc',
        ]);

        $total = (int) ($search['total'] ?? 0);
        $rows = is_array($search['rows'] ?? null) ? $search['rows'] : [];
        $filterSummary = (string) ($search['meta']['filter_summary'] ?? '');

        $pids = [];
        foreach ($rows as $row) {
            $pid = (int) ($row['pid'] ?? 0);
            if ($pid > 0) {
                $pids[] = $pid;
            }
        }

        $reachable = [];
        if ($pids !== []) {
            $placeholders = implode(',', array_fill(0, count($pids), '?'));
            $contacts = QueryUtils::fetchRecords(
                "SELECT pid, fname, lname, phone_normalized, phone_cell, email
                 FROM patient_data WHERE pid IN ($placeholders)",
                $pids
            ) ?: [];
            foreach ($contacts as $c) {
                $contact = $this->contactForChannel($c, $channel);
                if ($contact === '') {
                    continue;
                }
                $name = trim(((string) ($c['lname'] ?? '')) . ', ' . ((string) ($c['fname'] ?? '')), ' ,');
                $reachable[] = ['pid' => (int) ($c['pid'] ?? 0), 'name' => $name, 'contact' => $contact];
            }
        }

        return [
            'total' => $total,
            'reachable' => $reachable,
            'reachable_count' => count($reachable),
            'capped' => $total > self::MAX_RECIPIENTS,
            'filter_summary' => $filterSummary,
        ];
    }

    /**
     * @param array<string, mixed> $row
     */
    private function contactForChannel(array $row, string $channel): string
    {
        if ($channel === 'email') {
            $email = trim((string) ($row['email'] ?? ''));

            return str_contains($email, '@') ? $email : '';
        }

        $phone = trim((string) ($row['phone_normalized'] ?? ''));
        if ($phone === '') {
            $phone = trim((string) ($row['phone_cell'] ?? ''));
        }

        return $phone;
    }
}

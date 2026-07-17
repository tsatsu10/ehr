<?php

/**
 * Patient chart "Chat" tab thread — staff-facing UI only (2026-07-16).
 *
 * Persists a per-patient message thread in new_clinic_patient_chat_message.
 * There is no SMS/WhatsApp provider wired up yet — every message is
 * direction='out' (staff-authored) and stays inside the chart. The `in`
 * direction is reserved for a future inbound-delivery integration; nothing
 * writes it today.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ChatService
{
    /** Bounded read — a chat thread page renders the most recent window, not the full history. */
    public const MAX_MESSAGES = 200;
    public const MAX_BODY_LENGTH = 2000;

    /**
     * Most recent messages for a patient, oldest first (thread reading order).
     *
     * @return array{messages: array<int, array<string, mixed>>}
     */
    public function list(int $pid): array
    {
        $this->assertPid($pid);

        $rows = QueryUtils::fetchRecords(
            "SELECT m.id, m.direction, m.body, m.author_user_id, m.created_at,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.fname, u.lname)), ''), u.username, '') AS author
             FROM new_clinic_patient_chat_message m
             LEFT JOIN users u ON u.id = m.author_user_id
             WHERE m.pid = ?
             ORDER BY m.id DESC
             LIMIT " . self::MAX_MESSAGES,
            [$pid]
        ) ?: [];

        // Fetched newest-first (bounded LIMIT), reversed here so the thread renders oldest-first.
        $rows = array_reverse($rows);

        return [
            'messages' => array_map(fn(array $r): array => $this->shape($r), $rows),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function send(int $pid, string $body, int $actorUserId): array
    {
        $this->assertPid($pid);
        $body = trim($body);
        if ($body === '') {
            throw new \InvalidArgumentException('Message cannot be empty');
        }
        if (mb_strlen($body) > self::MAX_BODY_LENGTH) {
            throw new \InvalidArgumentException('Message is too long (max ' . self::MAX_BODY_LENGTH . ' characters)');
        }

        $id = QueryUtils::sqlInsert(
            "INSERT INTO new_clinic_patient_chat_message (pid, direction, body, author_user_id, created_at)
             VALUES (?, 'out', ?, ?, NOW())",
            [$pid, $body, $actorUserId > 0 ? $actorUserId : null]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'patient_chat_send',
            $actorUserId,
            1,
            'pid=' . $pid . ' message_id=' . $id
        );

        $row = QueryUtils::querySingleRow(
            "SELECT m.id, m.direction, m.body, m.author_user_id, m.created_at,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.fname, u.lname)), ''), u.username, '') AS author
             FROM new_clinic_patient_chat_message m
             LEFT JOIN users u ON u.id = m.author_user_id
             WHERE m.id = ?",
            [$id]
        );

        return $this->shape(is_array($row) ? $row : ['id' => $id, 'direction' => 'out', 'body' => $body]);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function shape(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'direction' => (string) ($row['direction'] ?? 'out'),
            'body' => (string) ($row['body'] ?? ''),
            'author' => (string) ($row['author'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }

    private function assertPid(int $pid): void
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
    }
}

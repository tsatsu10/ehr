<?php

/**
 * MedEx recall messaging adapter — first SCH-3 implementation
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\RecallMessaging;

use OpenEMR\Common\Database\QueryUtils;

class MedExRecallMessagingAdapter implements RecallMessagingPort
{
    public function isConfigured(): bool
    {
        return ($GLOBALS['medex_enable'] ?? '0') === '1';
    }

    public function getRecallDeliveryStatus(int $recallId, int $pid): array
    {
        if (!$this->isConfigured() || $pid <= 0) {
            return [
                'available' => false,
                'last_channel' => null,
                'last_status' => null,
            ];
        }

        $syntheticEid = 'recall_' . $pid;
        $row = QueryUtils::querySingleRow(
            "SELECT msg_type, msg_reply
             FROM medex_outgoing
             WHERE msg_pc_eid = ?
             ORDER BY msg_date DESC
             LIMIT 1",
            [$syntheticEid],
        ) ?: [];

        return [
            'available' => true,
            'last_channel' => isset($row['msg_type']) ? (string) $row['msg_type'] : null,
            'last_status' => isset($row['msg_reply']) ? (string) $row['msg_reply'] : null,
        ];
    }

    public function queueRecallReminder(int $recallId, int $pid, int $actorUserId): bool
    {
        if (!$this->isConfigured() || $recallId <= 0 || $pid <= 0) {
            return false;
        }

        $syntheticEid = 'recall_' . $pid;
        QueryUtils::sqlStatementThrowException(
            "INSERT INTO medex_outgoing (msg_pid, msg_pc_eid, msg_type, msg_reply, msg_extra_text)
             VALUES (?, ?, 'RECALL', 'QUEUED', ?)",
            [$pid, $syntheticEid, 'Queued from S1 Recall Worklist by user ' . $actorUserId],
        );

        return true;
    }
}

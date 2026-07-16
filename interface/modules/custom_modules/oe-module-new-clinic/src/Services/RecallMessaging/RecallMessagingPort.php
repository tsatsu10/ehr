<?php

/**
 * Recall messaging port — SCH-3 abstraction over MedEx / manual outreach
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\RecallMessaging;

interface RecallMessagingPort
{
    public function isConfigured(): bool;

    /**
     * @return array{available: bool, last_channel: string|null, last_status: string|null}
     */
    public function getRecallDeliveryStatus(int $recallId, int $pid): array;

    /**
     * Batched form of getRecallDeliveryStatus() — one query for a whole worklist page
     * instead of one per row (delivery status is keyed by patient, not by recall).
     *
     * @param array<int, int> $pids
     * @return array<int, array{available: bool, last_channel: string|null, last_status: string|null}> pid => status
     */
    public function batchGetRecallDeliveryStatus(array $pids): array;

    /**
     * Queue an automated recall reminder (no-op when not configured).
     */
    public function queueRecallReminder(int $recallId, int $pid, int $actorUserId): bool;
}

<?php

/**
 * Null recall messaging adapter — manual outreach only (SCH-3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\RecallMessaging;

class NullRecallMessagingAdapter implements RecallMessagingPort
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function getRecallDeliveryStatus(int $recallId, int $pid): array
    {
        return [
            'available' => false,
            'last_channel' => null,
            'last_status' => null,
        ];
    }

    public function queueRecallReminder(int $recallId, int $pid, int $actorUserId): bool
    {
        return false;
    }
}

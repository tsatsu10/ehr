<?php

/**
 * S1 calendar patient notify on move/resize — SCH-5 explicit confirm only
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class SchedulingCalendarNotifyService
{
    public function isMedExEnabled(): bool
    {
        return ($GLOBALS['medex_enable'] ?? '0') === '1';
    }

    /**
     * @return array{medex_enabled: bool, can_notify: bool, channels: list<string>}
     */
    public function patientNotifyContext(int $pid): array
    {
        if (!$this->isMedExEnabled() || $pid <= 0) {
            return [
                'medex_enabled' => false,
                'can_notify' => false,
                'channels' => [],
            ];
        }

        $row = QueryUtils::querySingleRow(
            'SELECT hipaa_allowsms, hipaa_allowemail, phone_cell, email
             FROM patient_data WHERE pid = ?',
            [$pid],
        ) ?: [];

        $channels = [];
        if (($row['hipaa_allowsms'] ?? '') === 'YES' && trim((string) ($row['phone_cell'] ?? '')) !== '') {
            $channels[] = 'sms';
        }
        if (($row['hipaa_allowemail'] ?? '') === 'YES' && trim((string) ($row['email'] ?? '')) !== '') {
            $channels[] = 'email';
        }

        return [
            'medex_enabled' => true,
            'can_notify' => $channels !== [],
            'channels' => $channels,
        ];
    }

    /**
     * Queue a reschedule notification after explicit staff confirmation (SCH-5).
     */
    public function queueRescheduleNotice(int $pcEid, int $pid, string $changeType, int $actorUserId): bool
    {
        if (!$this->isMedExEnabled() || $pcEid <= 0 || $pid <= 0) {
            return false;
        }

        $context = $this->patientNotifyContext($pid);
        if (!$context['can_notify']) {
            return false;
        }

        $appt = QueryUtils::querySingleRow(
            'SELECT pc_eventDate, pc_startTime FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [$pcEid],
        );
        if (empty($appt)) {
            return false;
        }

        $extra = sprintf(
            'S1 %s by user %d — %s %s',
            $changeType,
            $actorUserId,
            (string) ($appt['pc_eventDate'] ?? ''),
            substr((string) ($appt['pc_startTime'] ?? ''), 0, 5),
        );

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO medex_outgoing (msg_pid, msg_pc_eid, msg_type, msg_reply, msg_extra_text)
             VALUES (?, ?, 'SMS', 'QUEUED', ?)",
            [$pid, (string) $pcEid, $extra],
        );

        return true;
    }
}

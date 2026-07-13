<?php

/**
 * Stub outreach gateway — records intent, sends nothing (GAP-B B1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\Outreach;

class NullOutreachGateway implements OutreachGatewayPort
{
    public function isConfigured(): bool
    {
        return false;
    }

    /**
     * @param array<int, array{pid: int, contact: string}> $recipients
     * @return array{sent: int, failed: int, status: string, note: string}
     */
    public function send(string $channel, string $subject, string $body, array $recipients): array
    {
        return [
            'sent' => 0,
            'failed' => 0,
            'status' => 'stubbed',
            'note' => 'No messaging gateway is configured — the campaign was recorded but nothing was sent.',
        ];
    }
}

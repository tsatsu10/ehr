<?php

/**
 * Outreach delivery gateway (GAP-B B1).
 *
 * Abstraction over the actual SMS/email sender, mirroring the recall-messaging
 * port. V1 ships only the Null (stub) gateway — campaigns are recorded but not
 * sent — because the real provider (MoMo/SMS gateway, NG9-adjacent) is deferred
 * to its own spec. A future adapter implements this interface with no changes to
 * OutreachService.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\Outreach;

interface OutreachGatewayPort
{
    /** True once a real sending provider is wired for this clinic. */
    public function isConfigured(): bool;

    /**
     * Attempt delivery to the resolved, reachable recipients.
     *
     * @param string $channel 'sms' | 'email'
     * @param array<int, array{pid: int, contact: string}> $recipients
     * @return array{sent: int, failed: int, status: string, note: string}
     */
    public function send(string $channel, string $subject, string $body, array $recipients): array;
}

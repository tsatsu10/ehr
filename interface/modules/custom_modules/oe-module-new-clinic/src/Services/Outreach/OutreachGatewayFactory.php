<?php

/**
 * Resolves the active outreach gateway (GAP-B B1).
 *
 * Email is a real adapter (`EmailOutreachGateway`) once the clinic has a mail
 * transport + sender email configured — no provider decision needed. SMS is
 * still the stub until a provider adapter is wired behind this same port; when
 * that lands, this is where it plugs in (or a composite router by channel).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\Outreach;

class OutreachGatewayFactory
{
    public static function create(): OutreachGatewayPort
    {
        // Email sends for real when the clinic has mail configured; the email
        // gateway itself stubs any non-email channel, so SMS stays unsent until
        // its own adapter exists. Falls back to the pure stub when mail is off.
        if (EmailOutreachGateway::isAvailable()) {
            return new EmailOutreachGateway();
        }

        return new NullOutreachGateway();
    }
}

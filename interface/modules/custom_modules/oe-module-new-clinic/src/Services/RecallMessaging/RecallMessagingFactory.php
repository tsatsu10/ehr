<?php

/**
 * Recall messaging factory — selects MedEx or null adapter (SCH-3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\RecallMessaging;

class RecallMessagingFactory
{
    public static function create(): RecallMessagingPort
    {
        $adapter = new MedExRecallMessagingAdapter();
        if ($adapter->isConfigured()) {
            return $adapter;
        }

        return new NullRecallMessagingAdapter();
    }
}

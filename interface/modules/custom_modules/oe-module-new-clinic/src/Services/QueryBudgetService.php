<?php

/**
 * Per-request DB statement budget for read-only AJAX actions (SCALE-4.2)
 *
 * A pathological read (runaway LIKE scan, missed index, hostile filter combo)
 * should self-kill at the database after ~10 s instead of pinning an Apache
 * worker and a DB thread for minutes. MariaDB and MySQL spell this differently:
 *
 *   - MariaDB 10.1+:  SET SESSION max_statement_time = <seconds>   (any statement)
 *   - MySQL  5.7.8+:  SET SESSION max_execution_time = <millis>    (SELECT only)
 *
 * The server flavour comes from the connection handshake (ADODB ServerInfo()),
 * not a query, so applying the budget costs exactly one round-trip. Every part
 * fails OPEN (BP-8): a server without the variable, or any error applying it,
 * must never break a healthy request — it just runs unbudgeted like today.
 *
 * The PHP-side companion (set_time_limit) lives in AjaxController: on Linux the
 * PHP timer ignores time spent inside the DB call, so the DB-side kill is the
 * real guard for slow queries; the PHP limit catches compute loops.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class QueryBudgetService
{
    /** Seconds a single statement may run on a budgeted read request. */
    public const READ_BUDGET_SECONDS = 10;

    /**
     * The SET statement matching the given server version string, or null when
     * the server has no per-session statement timeout (pre-5.7.8 MySQL).
     * Pure, so the flavour switch is unit-testable.
     */
    public function statementFor(string $serverVersion, int $seconds): ?string
    {
        $seconds = max(1, $seconds);

        if (stripos($serverVersion, 'mariadb') !== false) {
            return 'SET SESSION max_statement_time = ' . $seconds;
        }

        // Strip any "-log"/distro suffix so version_compare sees plain digits.
        $numeric = preg_replace('/[^0-9.].*$/', '', trim($serverVersion)) ?: '0';
        if (version_compare($numeric, '5.7.8', '>=')) {
            return 'SET SESSION max_execution_time = ' . ($seconds * 1000);
        }

        return null;
    }

    /**
     * Apply the read budget to the current DB connection (per request ==
     * per connection; OpenEMR does not use persistent connections). NoLog +
     * throw-on-error so a failure can neither spam the audit log nor
     * HelpfulDie() the request.
     */
    public function applyReadBudget(int $seconds = self::READ_BUDGET_SECONDS): void
    {
        try {
            $info = $GLOBALS['adodb']['db']->ServerInfo();
            $statement = $this->statementFor((string) ($info['description'] ?? $info['version'] ?? ''), $seconds);
            if ($statement !== null) {
                sqlStatementNoLog($statement, false, true);
            }
        } catch (\Throwable) {
            // Fail open: no budget beats a broken read path.
        }
    }
}

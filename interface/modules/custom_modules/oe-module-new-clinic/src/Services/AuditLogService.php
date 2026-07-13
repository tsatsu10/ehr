<?php

/**
 * Read-only audit-log browser (GAP-C C1, closes W4).
 *
 * Native, paginated, filtered view over the core `log` table so admins can do
 * incident review without the 2005-era logview screen. Strictly read-only and
 * always bounded (R2). Tamper-check / hash verification stays on the stock
 * screen (a gateway card), deliberately out of scope here.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class AuditLogService
{
    private const PAGE_SIZE_DEFAULT = 25;
    private const PAGE_SIZE_MAX = 50;
    private const EXPORT_MAX = 5000;

    private function assertAccess(): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            throw new \RuntimeException('Audit log access denied', 403);
        }
    }

    /**
     * @param array<string, mixed> $request
     * @return array<string, mixed>
     */
    public function query(array $request): array
    {
        $this->assertAccess();

        $page = max(1, (int) ($request['page'] ?? 1));
        $pageSize = min(max((int) ($request['page_size'] ?? self::PAGE_SIZE_DEFAULT), 1), self::PAGE_SIZE_MAX);
        [$where, $bind] = $this->buildWhere($request);
        $whereSql = implode(' AND ', $where);

        $countRow = QueryUtils::querySingleRow("SELECT COUNT(*) AS c FROM log WHERE {$whereSql}", $bind);
        $total = is_array($countRow) ? (int) ($countRow['c'] ?? 0) : 0;

        $offset = ($page - 1) * $pageSize;
        $rows = QueryUtils::fetchRecords(
            "SELECT id, date, event, category, user, patient_id, success, comments
             FROM log
             WHERE {$whereSql}
             ORDER BY date DESC, id DESC
             LIMIT " . (int) $pageSize . " OFFSET " . (int) $offset,
            $bind
        ) ?: [];

        return [
            'rows' => array_map(fn (array $r): array => $this->mapRow($r, true), $rows),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(int $id): array
    {
        $this->assertAccess();
        if ($id <= 0) {
            throw new \InvalidArgumentException('Log id is required');
        }
        $row = QueryUtils::querySingleRow(
            "SELECT id, date, event, category, user, patient_id, success, comments, user_notes
             FROM log WHERE id = ?",
            [$id]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Log entry not found');
        }
        $mapped = $this->mapRow($row, false);
        $mapped['user_notes'] = (string) ($row['user_notes'] ?? '');

        return $mapped;
    }

    /**
     * CSV of the current filter (bounded), for incident review / handoff.
     *
     * @param array<string, mixed> $request
     * @return array{filename: string, content: string, row_count: int}
     */
    public function export(array $request): array
    {
        $this->assertAccess();
        [$where, $bind] = $this->buildWhere($request);
        $whereSql = implode(' AND ', $where);

        $rows = QueryUtils::fetchRecords(
            "SELECT date, event, category, user, patient_id, success, comments
             FROM log
             WHERE {$whereSql}
             ORDER BY date DESC, id DESC
             LIMIT " . self::EXPORT_MAX,
            $bind
        ) ?: [];

        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['Date', 'Event', 'Category', 'User', 'Patient ID', 'Success', 'Comments']);
        foreach ($rows as $r) {
            fputcsv($handle, [
                (string) ($r['date'] ?? ''),
                (string) ($r['event'] ?? ''),
                (string) ($r['category'] ?? ''),
                (string) ($r['user'] ?? ''),
                (string) ($r['patient_id'] ?? ''),
                ((int) ($r['success'] ?? 1)) === 1 ? 'yes' : 'no',
                (string) ($r['comments'] ?? ''),
            ]);
        }
        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        return [
            'filename' => 'audit-log-' . date('Ymd-His') . '.csv',
            'content' => $content,
            'row_count' => count($rows),
        ];
    }

    /**
     * @param array<string, mixed> $request
     * @return array{0: array<int, string>, 1: array<int, mixed>}
     */
    private function buildWhere(array $request): array
    {
        $where = ['1=1'];
        $bind = [];

        $dateFrom = trim((string) ($request['date_from'] ?? ''));
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            $where[] = 'date >= ?';
            $bind[] = $dateFrom . ' 00:00:00';
        }
        $dateTo = trim((string) ($request['date_to'] ?? ''));
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
            $where[] = 'date <= ?';
            $bind[] = $dateTo . ' 23:59:59';
        }
        $user = trim((string) ($request['user'] ?? ''));
        if ($user !== '') {
            $where[] = 'user LIKE ?';
            $bind[] = '%' . $user . '%';
        }
        $q = trim((string) ($request['q'] ?? ''));
        if ($q !== '') {
            $where[] = '(event LIKE ? OR category LIKE ? OR comments LIKE ?)';
            $like = '%' . $q . '%';
            array_push($bind, $like, $like, $like);
        }
        $success = (string) ($request['success'] ?? '');
        if ($success === '0' || $success === '1') {
            $where[] = 'success = ?';
            $bind[] = (int) $success;
        }
        $patientId = (int) ($request['patient_id'] ?? 0);
        if ($patientId > 0) {
            $where[] = 'patient_id = ?';
            $bind[] = $patientId;
        }

        return [$where, $bind];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row, bool $preview): array
    {
        $comments = (string) ($row['comments'] ?? '');

        return [
            'id' => (int) ($row['id'] ?? 0),
            'date' => (string) ($row['date'] ?? ''),
            'event' => (string) ($row['event'] ?? ''),
            'category' => (string) ($row['category'] ?? ''),
            'user' => (string) ($row['user'] ?? ''),
            'patient_id' => (int) ($row['patient_id'] ?? 0),
            'success' => ((int) ($row['success'] ?? 1)) === 1,
            'comments' => $preview ? $this->clip($comments, 140) : $comments,
        ];
    }

    private function clip(string $value, int $max): string
    {
        return mb_strlen($value) <= $max ? $value : (mb_substr($value, 0, $max - 1) . '…');
    }
}

<?php

/**
 * OfficeNotesService — New Clinic Office Notes (GAP-A / A1, closes G1).
 *
 * Writes delegate to core OpenEMR\Services\ONoteService (the `onotes` table) — no
 * duplicated write SQL. Pin state lives in the module-owned companion table
 * `new_office_note_meta` (core `onotes` is left untouched). The list read is a
 * LEFT JOIN so pinned notes float to the top across the whole list, not just a page.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\ONoteService;

class OfficeNotesService
{
    public const PAGE_SIZE = 20;

    public function __construct(
        private readonly ONoteService $core = new ONoteService(),
    ) {
    }

    /**
     * @return array{notes: array<int, array<string, mixed>>, total: int, offset: int, page_size: int, filter: string}
     */
    public function list(string $filter = 'active', int $offset = 0): array
    {
        $filter = $this->normalizeFilter($filter);
        $offset = max(0, $offset);
        $limit = self::PAGE_SIZE;

        [$where, $bind] = $this->filterClause($filter);

        $rows = QueryUtils::fetchRecords(
            "SELECT o.id, o.body, o.user, o.date, o.activity, COALESCE(m.pinned, 0) AS pinned
             FROM onotes o
             LEFT JOIN new_office_note_meta m ON m.onote_id = o.id
             {$where}
             ORDER BY COALESCE(m.pinned, 0) DESC, o.date DESC
             LIMIT " . (int) $limit . " OFFSET " . (int) $offset,
            $bind
        ) ?: [];

        $countRows = QueryUtils::fetchRecords(
            "SELECT COUNT(*) AS cnt FROM onotes o {$where}",
            $bind
        );
        $total = (int) ($countRows[0]['cnt'] ?? 0);

        return [
            'notes' => array_map([$this, 'shape'], $rows),
            'total' => $total,
            'offset' => $offset,
            'page_size' => self::PAGE_SIZE,
            'filter' => $filter,
        ];
    }

    /**
     * Create (id <= 0) or edit (id > 0) a note. Returns the note id.
     */
    public function save(int $id, string $body): int
    {
        $body = trim($body);
        if ($body === '') {
            throw new \RuntimeException('Note text is required');
        }

        if ($id > 0) {
            $this->core->updateNoteById($id, $body);
            return $id;
        }

        return (int) $this->core->add($body);
    }

    public function setActive(int $id, bool $active): void
    {
        $this->assertId($id);

        if ($active) {
            $this->core->enableNoteById($id);
        } else {
            $this->core->disableNoteById($id);
        }
    }

    public function setPinned(int $id, bool $pinned): void
    {
        $this->assertId($id);

        sqlStatement(
            "INSERT INTO `new_office_note_meta` (`onote_id`, `pinned`) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE `pinned` = VALUES(`pinned`)",
            [$id, $pinned ? 1 : 0]
        );
    }

    public function delete(int $id): void
    {
        $this->assertId($id);

        $this->core->deleteNoteById($id);
        sqlStatement("DELETE FROM `new_office_note_meta` WHERE `onote_id` = ?", [$id]);
    }

    /**
     * @return array{0: string, 1: array<int, mixed>}
     */
    private function filterClause(string $filter): array
    {
        return match ($filter) {
            'active' => ['WHERE o.activity = ?', [1]],
            'archived' => ['WHERE o.activity = ?', [0]],
            default => ['', []], // 'all'
        };
    }

    private function assertId(int $id): void
    {
        if ($id <= 0) {
            throw new \RuntimeException('Invalid note');
        }
    }

    private function normalizeFilter(string $filter): string
    {
        return in_array($filter, ['active', 'archived', 'all'], true) ? $filter : 'active';
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function shape(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'body' => (string) ($row['body'] ?? ''),
            'user' => (string) ($row['user'] ?? ''),
            'date' => (string) ($row['date'] ?? ''),
            'active' => ((int) ($row['activity'] ?? 0)) === 1,
            'pinned' => ((int) ($row['pinned'] ?? 0)) === 1,
        ];
    }
}

<?php

/**
 * OfficeNotesService — thin New Clinic wrapper over core ONoteService (GAP-A / A1).
 *
 * Closes gap G1: clinic-wide sticky notes. Delegates all persistence to core
 * OpenEMR\Services\ONoteService (the `onotes` table) — no new schema, no new SQL —
 * and shapes rows into a typed, paginated payload for the `office-notes` island.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

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
        $activity = $this->filterToActivity($filter);
        $offset = max(0, $offset);

        $rows = $this->core->getNotes($activity, $offset, self::PAGE_SIZE);
        $total = (int) $this->core->countNotes($activity);

        return [
            'notes' => array_map([$this, 'shape'], $rows),
            'total' => $total,
            'offset' => $offset,
            'page_size' => self::PAGE_SIZE,
            'filter' => $this->normalizeFilter($filter),
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
        if ($id <= 0) {
            throw new \RuntimeException('Invalid note');
        }

        if ($active) {
            $this->core->enableNoteById($id);
        } else {
            $this->core->disableNoteById($id);
        }
    }

    public function delete(int $id): void
    {
        if ($id <= 0) {
            throw new \RuntimeException('Invalid note');
        }

        $this->core->deleteNoteById($id);
    }

    private function filterToActivity(string $filter): int
    {
        return match ($this->normalizeFilter($filter)) {
            'active' => 1,
            'archived' => 0,
            default => -1, // 'all'
        };
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
        ];
    }
}

<?php

/**
 * Per-patient documents manager (GAP-A / A2, closes G2).
 *
 * A thin, hardened wrapper over the core Document storage layer so the New
 * Clinic MRD Documents tab can list, upload, recategorize, and (soft) delete
 * patient documents without deep-linking the stock controller.php UI.
 *
 * Storage is 100% core: uploads go through \Document::createDocument (the same
 * path as stock and as ReferralDocumentService); category membership lives in
 * categories_to_documents; delete is the standard soft-delete (documents.deleted
 * = 1), matching every core read filter and keeping the file recoverable.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class DocumentsService
{
    public const PAGE_SIZE = 25;
    public const MAX_BYTES = 10_485_760;

    /**
     * V1 accepts the document types the clinic actually scans/photographs at the
     * desk. Widening this stays inside isWhiteFile / secure_upload server policy;
     * kept tight here to remain within the vetted ReferralDocumentService envelope.
     *
     * @var array<int, string>
     */
    private const ALLOWED_MIMES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ];

    /**
     * Documents for a patient, newest first, with category + uploader labels.
     *
     * @return array{documents: array<int, array<string, mixed>>, total: int, offset: int, page_size: int}
     */
    public function list(int $pid, int $offset = 0): array
    {
        $this->assertPid($pid);
        $offset = max(0, $offset);
        $limit = self::PAGE_SIZE;

        $rows = QueryUtils::fetchRecords(
            "SELECT d.id, d.name, d.mimetype, d.size, d.docdate, d.date, d.owner,
                    ctd.category_id,
                    COALESCE(c.name, '') AS category_name,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.fname, u.lname)), ''), u.username, '') AS uploader
             FROM documents d
             LEFT JOIN categories_to_documents ctd ON ctd.document_id = d.id
             LEFT JOIN categories c ON c.id = ctd.category_id
             LEFT JOIN users u ON u.id = d.owner
             WHERE d.foreign_id = ? AND d.deleted = 0
             ORDER BY COALESCE(d.docdate, d.date) DESC, d.id DESC
             LIMIT " . (int) $limit . " OFFSET " . (int) $offset,
            [$pid]
        ) ?: [];

        $countRows = QueryUtils::fetchRecords(
            "SELECT COUNT(*) AS cnt FROM documents WHERE foreign_id = ? AND deleted = 0",
            [$pid]
        );
        $total = (int) ($countRows[0]['cnt'] ?? 0);

        return [
            'documents' => array_map(fn(array $r): array => $this->shape($pid, $r), $rows),
            'total' => $total,
            'offset' => $offset,
            'page_size' => self::PAGE_SIZE,
        ];
    }

    /**
     * Document categories the current user may file into. Stock `categories`
     * has no active/inactive concept (confirmed against schema and core
     * CategoryTree.class.php, which never filters on it) — every row is a
     * candidate, narrowed only by ACO-spec visibility below.
     *
     * @return array<int, array{id: int, name: string}>
     */
    public function categories(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, name, aco_spec FROM categories ORDER BY lft, name",
            []
        ) ?: [];

        $out = [];
        foreach ($rows as $row) {
            $acoSpec = (string) ($row['aco_spec'] ?? '');
            if ($acoSpec !== '' && AclMain::aclCheckAcoSpec($acoSpec) === false) {
                continue;
            }
            $out[] = [
                'id' => (int) $row['id'],
                'name' => (string) ($row['name'] ?? ''),
            ];
        }

        return $out;
    }

    /**
     * Store a new document for a patient in the given category.
     *
     * @param array<string, mixed> $file One PHP $_FILES entry (single file)
     * @return array{document_id: int, filename: string}
     */
    public function upload(int $pid, int $categoryId, array $file, int $actorUserId): array
    {
        $this->assertPid($pid);
        $categoryId = $this->resolveCategoryId($categoryId);
        $this->assertCategoryWritable($categoryId);
        $this->assertValidUpload($file);

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $originalName = $this->sanitizeFilename((string) ($file['name'] ?? 'document'));
        $size = (int) ($file['size'] ?? 0);
        $data = (string) file_get_contents($tmpName);
        if ($data === '' || strlen($data) !== $size) {
            throw new \InvalidArgumentException('Uploaded file could not be read');
        }

        $mimetype = mime_content_type($tmpName) ?: '';
        if ($mimetype === '' || !in_array($mimetype, self::ALLOWED_MIMES, true)) {
            throw new \InvalidArgumentException('File must be a PDF or image (JPEG, PNG, GIF, WebP)');
        }

        if (!function_exists('isWhiteFile')) {
            require_once dirname(__DIR__, 6) . '/library/sanitize.inc.php';
        }
        if (!empty($GLOBALS['secure_upload']) && !isWhiteFile($tmpName)) {
            throw new \InvalidArgumentException('File type is not permitted by server policy');
        }

        if (!class_exists(\Document::class)) {
            require_once dirname(__DIR__, 6) . '/library/classes/Document.class.php';
        }

        $document = new \Document();
        $error = $document->createDocument(
            $pid,
            $categoryId,
            $originalName,
            $mimetype,
            $data,
            '',
            1,
            $actorUserId,
            $tmpName
        );
        if ($error !== '') {
            throw new \RuntimeException(trim((string) $error));
        }

        $documentId = (int) $document->get_id();
        if ($documentId <= 0) {
            throw new \RuntimeException('Failed to store document');
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'document_upload',
            $actorUserId,
            1,
            'pid=' . $pid . ' document_id=' . $documentId . ' category=' . $categoryId
                . ' filename=' . mb_substr($originalName, 0, 120)
        );

        return [
            'document_id' => $documentId,
            'filename' => $originalName,
        ];
    }

    /**
     * Move a document to a different category (single-membership model, as the
     * MRD tab presents it — mirrors stock move_action_process).
     */
    public function recategorize(int $pid, int $documentId, int $categoryId): void
    {
        $this->assertPid($pid);
        $this->assertBelongsToPatient($documentId, $pid);
        $categoryId = $this->resolveCategoryId($categoryId);
        $this->assertCategoryWritable($categoryId);

        sqlStatement(
            "UPDATE categories_to_documents SET category_id = ? WHERE document_id = ?",
            [$categoryId, $documentId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'document_recategorize',
            $_SESSION['authUserID'] ?? 0,
            1,
            'pid=' . $pid . ' document_id=' . $documentId . ' category=' . $categoryId
        );
    }

    /**
     * Soft-delete: flag documents.deleted = 1. Recoverable, and consistent with
     * every core read path (which filters deleted = 0). The physical file is left
     * on disk deliberately — hard delete stays on the stock screen.
     */
    public function delete(int $pid, int $documentId): void
    {
        $this->assertPid($pid);
        $this->assertBelongsToPatient($documentId, $pid);

        sqlStatement(
            "UPDATE documents SET deleted = 1 WHERE id = ? AND foreign_id = ?",
            [$documentId, $pid]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'document_delete',
            $_SESSION['authUserID'] ?? 0,
            1,
            'pid=' . $pid . ' document_id=' . $documentId
        );
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function shape(int $pid, array $row): array
    {
        $documentId = (int) ($row['id'] ?? 0);

        return [
            'id' => $documentId,
            'name' => (string) ($row['name'] ?? ''),
            'mimetype' => (string) ($row['mimetype'] ?? ''),
            'size' => (int) ($row['size'] ?? 0),
            'date' => (string) ($row['docdate'] ?: $row['date'] ?? ''),
            'category_id' => (int) ($row['category_id'] ?? 0),
            'category_name' => (string) ($row['category_name'] ?? ''),
            'uploader' => (string) ($row['uploader'] ?? ''),
            'view_url' => $this->buildViewUrl($pid, $documentId),
        ];
    }

    private function buildViewUrl(int $pid, int $documentId): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/controller.php?document&retrieve&patient_id='
            . urlencode((string) $pid)
            . '&document_id=' . urlencode((string) $documentId)
            . '&as_file=false';
    }

    private function assertBelongsToPatient(int $documentId, int $pid): void
    {
        if ($documentId <= 0) {
            throw new \InvalidArgumentException('Document is required');
        }
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM documents WHERE id = ? AND foreign_id = ? AND deleted = 0",
            [$documentId, $pid]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Document does not belong to this patient');
        }
    }

    private function assertCategoryWritable(int $categoryId): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT aco_spec FROM categories WHERE id = ?",
            [$categoryId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Selected category is not available');
        }
        $acoSpec = (string) ($row['aco_spec'] ?? '');
        if ($acoSpec !== '' && AclMain::aclCheckAcoSpec($acoSpec) === false) {
            throw new \RuntimeException('Not authorized to file into the selected category');
        }
    }

    private function resolveCategoryId(int $categoryId): int
    {
        if ($categoryId > 0) {
            return $categoryId;
        }

        // Fall back to the root "Categories" node (id 1 in stock installs).
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM categories WHERE parent = 0 ORDER BY id ASC LIMIT 1",
            []
        );

        return is_array($row) ? (int) ($row['id'] ?? 1) : 1;
    }

    /**
     * @param array<string, mixed> $file
     */
    private function assertValidUpload(array $file): void
    {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode === UPLOAD_ERR_NO_FILE) {
            throw new \InvalidArgumentException('No file was uploaded');
        }
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('Upload failed (error ' . $errorCode . ')');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new \InvalidArgumentException('File is empty');
        }
        if ($size > self::MAX_BYTES) {
            throw new \InvalidArgumentException('File exceeds the 10 MB limit');
        }

        $name = trim((string) ($file['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('File name is required');
        }
    }

    private function sanitizeFilename(string $filename): string
    {
        $filename = basename(str_replace('\\', '/', $filename));
        $filename = preg_replace('/[^\w.\- ()]+/u', '_', $filename) ?? 'document';
        $filename = trim($filename);
        if ($filename === '' || $filename === '.' || $filename === '..') {
            return 'document';
        }

        return mb_substr($filename, 0, 200);
    }

    private function assertPid(int $pid): void
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
    }
}

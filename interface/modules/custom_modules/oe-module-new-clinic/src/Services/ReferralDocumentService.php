<?php

/**
 * M1d-F10 — inbound referral document upload for lab-direct Start visit (D34)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ReferralDocumentService
{
    public const MAX_BYTES = 10_485_760;

    /** @var array<int, string> */
    private const ALLOWED_MIMES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ];

    /**
     * @param array<string, mixed> $file One PHP $_FILES entry (single file, not array-of-files)
     * @return array{document_id: int, filename: string, view_url: string}
     */
    public function uploadForPatient(int $pid, array $file, int $actorUserId): array
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }

        $this->assertValidUpload($file);

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $originalName = $this->sanitizeFilename((string) ($file['name'] ?? 'referral'));
        $size = (int) ($file['size'] ?? 0);
        $data = (string) file_get_contents($tmpName);
        if ($data === '' || strlen($data) !== $size) {
            throw new \InvalidArgumentException('Uploaded referral file could not be read');
        }

        $mimetype = mime_content_type($tmpName) ?: '';
        if ($mimetype === '' || !in_array($mimetype, self::ALLOWED_MIMES, true)) {
            throw new \InvalidArgumentException('Referral must be a PDF or image (JPEG, PNG, GIF, WebP)');
        }

        if (!function_exists('isWhiteFile')) {
            require_once dirname(__DIR__, 6) . '/library/sanitize.inc.php';
        }
        if (!empty($GLOBALS['secure_upload']) && !isWhiteFile($tmpName)) {
            throw new \InvalidArgumentException('Referral file type is not permitted by server policy');
        }

        if (!class_exists(\Document::class)) {
            require_once dirname(__DIR__, 6) . '/library/classes/Document.class.php';
        }

        $categoryId = $this->resolveInboundReferralCategoryId();
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
            throw new \RuntimeException('Failed to store referral document');
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'referral_document_upload',
            $actorUserId,
            1,
            'pid=' . $pid . ' document_id=' . $documentId . ' filename=' . mb_substr($originalName, 0, 120)
        );

        return [
            'document_id' => $documentId,
            'filename' => $originalName,
            'view_url' => (string) ($this->buildViewUrl($pid, $documentId) ?? ''),
        ];
    }

    public function assertBelongsToPatient(int $documentId, int $pid): void
    {
        if ($documentId <= 0 || $pid <= 0) {
            throw new \InvalidArgumentException('Invalid referral document reference');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM documents WHERE id = ? AND foreign_id = ? AND deleted = 0',
            [$documentId, $pid]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Referral document does not belong to this patient');
        }
    }

    public function buildViewUrl(int $pid, int $documentId): ?string
    {
        if ($pid <= 0 || $documentId <= 0) {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM documents WHERE id = ? AND foreign_id = ? AND deleted = 0',
            [$documentId, $pid]
        );
        if (!is_array($row)) {
            return null;
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/controller.php?document&retrieve&patient_id='
            . urlencode((string) $pid)
            . '&document_id=' . urlencode((string) $documentId)
            . '&as_file=false';
    }

    /**
     * @param array<string, mixed> $file
     */
    public function assertValidUpload(array $file): void
    {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode === UPLOAD_ERR_NO_FILE) {
            throw new \InvalidArgumentException('No referral file was uploaded');
        }
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('Referral upload failed (error ' . $errorCode . ')');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new \InvalidArgumentException('Referral file is empty');
        }
        if ($size > self::MAX_BYTES) {
            throw new \InvalidArgumentException('Referral file exceeds the 10 MB limit');
        }

        $name = trim((string) ($file['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Referral file name is required');
        }
    }

    private function sanitizeFilename(string $filename): string
    {
        $filename = basename(str_replace('\\', '/', $filename));
        $filename = preg_replace('/[^\w.\- ()]+/u', '_', $filename) ?? 'referral';
        $filename = trim($filename);
        if ($filename === '' || $filename === '.' || $filename === '..') {
            return 'referral';
        }

        return mb_substr($filename, 0, 200);
    }

    private function resolveInboundReferralCategoryId(): int
    {
        foreach (['Referral', 'Referrals', 'Lab Report', 'Lab Reports'] as $name) {
            $row = QueryUtils::querySingleRow(
                "SELECT id FROM categories WHERE name = ? AND active = 1 ORDER BY id ASC LIMIT 1",
                [$name]
            );
            if (is_array($row) && (int) ($row['id'] ?? 0) > 0) {
                return (int) $row['id'];
            }
        }

        return 1;
    }
}

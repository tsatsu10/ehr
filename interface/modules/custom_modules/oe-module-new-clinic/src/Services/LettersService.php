<?php

/**
 * Referral letters + patient label prints (GAP-A / A4, closes G4).
 *
 * Letters reuse the STOCK template engine end to end: flat-file templates in
 * sites/<site>/documents/letter_templates (the same directory stock
 * interface/patient_file/letter.php reads and writes), and the same
 * {TOKEN} vocabulary — PT_* from patient_data, FROM_* from the sending user's
 * users row, TO_* from an address-book contact (a users row managed by the
 * A3 Directory tab), DATE. A template authored on the stock screen renders
 * identically here and vice versa; this service adds no second template store.
 * (The `document_templates` TABLE is the patient-portal template system and
 * is deliberately NOT used here.)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Crypto\CryptoGen;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LettersService
{
    /** Contact-not-a-login guard — same rule as DirectoryContactService. */
    private const CONTACT_GUARD = "(username = '' OR username IS NULL)";

    /** Stock letter.php's scratch file — never offered as a pickable template. */
    private const AUTOSAVED_TEMPLATE = 'autosaved';

    public const LABEL_TYPES = ['chart', 'address', 'barcode'];

    private ?ClinicConfigService $config = null;
    private ?FacilityScopeService $facilityScope = null;

    public function __construct(
        ?ClinicConfigService $config = null,
        ?FacilityScopeService $facilityScope = null,
    ) {
        $this->config = $config;
        $this->facilityScope = $facilityScope;
    }

    private function getConfig(): ClinicConfigService
    {
        if ($this->config === null) {
            $this->config = new ClinicConfigService();
        }

        return $this->config;
    }

    private function getFacilityScope(): FacilityScopeService
    {
        if ($this->facilityScope === null) {
            $this->facilityScope = new FacilityScopeService();
        }

        return $this->facilityScope;
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        return $this->getConfig()->isEnabled('enable_letters_labels', 0, $facilityId);
    }

    public function assertEnabled(): void
    {
        if (!$this->isEnabled()) {
            throw new \RuntimeException('Letters and labels are not enabled for this clinic', 403);
        }
    }

    private function templateDir(): string
    {
        return rtrim((string) ($GLOBALS['OE_SITE_DIR'] ?? ''), '/\\') . '/documents/letter_templates';
    }

    /**
     * Picker payload: template names + TO contacts (A3 directory) in one call.
     *
     * @return array<string, mixed>
     */
    public function getTemplatesPayload(int $pid): array
    {
        $this->assertEnabled();
        $this->getFacilityScope()->assertPatientAccessible($pid);

        return [
            'templates' => $this->listTemplates(),
            'contacts' => $this->listContactsForPicker(),
        ];
    }

    /**
     * @return array<int, array{name: string}>
     */
    public function listTemplates(): array
    {
        $dir = $this->templateDir();
        if (!is_dir($dir)) {
            return [];
        }

        $names = [];
        foreach (scandir($dir) ?: [] as $entry) {
            if (str_starts_with($entry, '.') || $entry === self::AUTOSAVED_TEMPLATE) {
                continue;
            }
            if (!is_file($dir . '/' . $entry)) {
                continue;
            }
            $names[] = ['name' => $entry];
        }
        usort($names, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));

        return $names;
    }

    /**
     * Lean directory-contact list for the TO picker (read-only; the admin CRUD
     * stays behind new_admin on the Directory tab).
     *
     * @return array<int, array{id: int, label: string}>
     */
    public function listContactsForPicker(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT u.id, u.title, u.fname, u.lname, u.organization,
                    COALESCE(lo.title, '') AS type_label
             FROM users u
             LEFT JOIN list_options lo
                 ON lo.list_id = 'abook_type' AND lo.option_id = u.abook_type AND lo.activity = 1
             WHERE u.active = 1 AND u.abook_type != '' AND " . self::CONTACT_GUARD . "
             ORDER BY COALESCE(NULLIF(u.organization, ''), CONCAT(u.lname, u.fname))"
        ) ?: [];

        return array_map(static function (array $row): array {
            $person = trim(implode(' ', array_filter([
                (string) ($row['title'] ?? ''),
                (string) ($row['fname'] ?? ''),
                (string) ($row['lname'] ?? ''),
            ])));
            $org = trim((string) ($row['organization'] ?? ''));
            $label = $org !== '' && $person !== '' ? "$person — $org" : ($org !== '' ? $org : $person);
            $type = trim((string) ($row['type_label'] ?? ''));
            if ($type !== '') {
                $label .= " ($type)";
            }

            return ['id' => (int) $row['id'], 'label' => $label];
        }, $rows);
    }

    /**
     * Load a template file and fill its {TOKEN}s. Same vocabulary as stock
     * letter.php so templates are interchangeable between both screens.
     *
     * @return array{body: string, template: string}
     */
    public function renderLetter(int $pid, string $templateName, int $toContactId, int $fromUserId): array
    {
        $this->assertEnabled();
        $this->getFacilityScope()->assertPatientAccessible($pid);

        $body = $this->loadTemplateBody($templateName);

        $patient = QueryUtils::querySingleRow(
            "SELECT fname, mname, lname, DOB, street, city, state, postal_code,
                    phone_home, phone_cell, ss, email
             FROM patient_data WHERE pid = ? LIMIT 1",
            [$pid]
        );
        if (!is_array($patient)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        $from = QueryUtils::querySingleRow(
            "SELECT title, fname, mname, lname, street, city, state, zip,
                    phone, phonecell, email, valedictory
             FROM users WHERE id = ? LIMIT 1",
            [$fromUserId]
        ) ?: [];

        $to = [];
        if ($toContactId > 0) {
            $to = QueryUtils::querySingleRow(
                "SELECT title, fname, mname, lname, street, city, state, zip,
                        phone, phonecell, fax, organization, valedictory
                 FROM users WHERE id = ? AND " . self::CONTACT_GUARD . " LIMIT 1",
                [$toContactId]
            ) ?: [];
            if ($to === []) {
                throw new \InvalidArgumentException('Recipient contact not found');
            }
        }

        $fromTitle = trim((string) ($from['title'] ?? ''));
        $toTitle = trim((string) ($to['title'] ?? ''));

        $tokens = [
            'DATE' => oeFormatShortDate(date('Y-m-d')),
            'FROM_TITLE' => $fromTitle !== '' ? $fromTitle : '',
            'FROM_FNAME' => (string) ($from['fname'] ?? ''),
            'FROM_LNAME' => (string) ($from['lname'] ?? ''),
            'FROM_MNAME' => (string) ($from['mname'] ?? ''),
            'FROM_STREET' => (string) ($from['street'] ?? ''),
            'FROM_CITY' => (string) ($from['city'] ?? ''),
            'FROM_STATE' => (string) ($from['state'] ?? ''),
            'FROM_POSTAL' => (string) ($from['zip'] ?? ''),
            'FROM_VALEDICTORY' => (string) ($from['valedictory'] ?? ''),
            'FROM_PHONE' => (string) ($from['phone'] ?? ''),
            'FROM_PHONECELL' => (string) ($from['phonecell'] ?? ''),
            'FROM_EMAIL' => (string) ($from['email'] ?? ''),
            'TO_TITLE' => $toTitle !== '' ? $toTitle : '',
            'TO_FNAME' => (string) ($to['fname'] ?? ''),
            'TO_LNAME' => (string) ($to['lname'] ?? ''),
            'TO_MNAME' => (string) ($to['mname'] ?? ''),
            'TO_STREET' => (string) ($to['street'] ?? ''),
            'TO_CITY' => (string) ($to['city'] ?? ''),
            'TO_STATE' => (string) ($to['state'] ?? ''),
            'TO_POSTAL' => (string) ($to['zip'] ?? ''),
            'TO_VALEDICTORY' => (string) ($to['valedictory'] ?? ''),
            'TO_PHONE' => (string) ($to['phone'] ?? ''),
            'TO_PHONECELL' => (string) ($to['phonecell'] ?? ''),
            'TO_FAX' => (string) ($to['fax'] ?? ''),
            'TO_ORGANIZATION' => (string) ($to['organization'] ?? ''),
            'PT_FNAME' => (string) ($patient['fname'] ?? ''),
            'PT_LNAME' => (string) ($patient['lname'] ?? ''),
            'PT_MNAME' => (string) ($patient['mname'] ?? ''),
            'PT_STREET' => (string) ($patient['street'] ?? ''),
            'PT_CITY' => (string) ($patient['city'] ?? ''),
            'PT_STATE' => (string) ($patient['state'] ?? ''),
            'PT_POSTAL' => (string) ($patient['postal_code'] ?? ''),
            'PT_PHONE_HOME' => (string) ($patient['phone_home'] ?? ''),
            'PT_PHONE_CELL' => (string) ($patient['phone_cell'] ?? ''),
            'PT_SSN' => (string) ($patient['ss'] ?? ''),
            'PT_EMAIL' => (string) ($patient['email'] ?? ''),
            'PT_DOB' => oeFormatShortDate((string) ($patient['DOB'] ?? '')),
        ];

        $body = $this->fillTokens($body, $tokens);

        return ['body' => $body, 'template' => $templateName];
    }

    /**
     * Token replacement honoring both the raw {KEY} form and stock's
     * translated {xl(KEY)} form, exactly as letter.php stores/loads them.
     *
     * @param array<string, string> $tokens
     */
    public function fillTokens(string $body, array $tokens): string
    {
        foreach ($tokens as $key => $value) {
            $body = str_replace('{' . $key . '}', $value, $body);
            $translated = xl($key);
            if ($translated !== $key) {
                $body = str_replace('{' . $translated . '}', $value, $body);
            }
        }

        return $body;
    }

    /**
     * Path-traversal-safe template filename or throw. Public static so the
     * guard itself is unit-testable without a DB.
     */
    public static function sanitizeTemplateName(string $templateName): string
    {
        $safeName = basename(trim($templateName));
        if (
            $safeName === ''
            || $safeName !== trim($templateName)
            || $safeName === self::AUTOSAVED_TEMPLATE
            || str_starts_with($safeName, '.')
        ) {
            throw new \InvalidArgumentException('Template name is invalid');
        }

        return $safeName;
    }

    private function loadTemplateBody(string $templateName): string
    {
        $safeName = self::sanitizeTemplateName($templateName);

        $path = $this->templateDir() . '/' . $safeName;
        if (!is_file($path)) {
            throw new \InvalidArgumentException('Template not found');
        }

        $body = (string) file_get_contents($path);

        // Stock letter.php encrypts template files when drive_encryption is on.
        $cryptoGen = new CryptoGen();
        if ($cryptoGen->cryptCheckStandard($body)) {
            $body = (string) $cryptoGen->decryptStandard($body, null, 'database');
        }

        return $body;
    }

    /**
     * Label print payload (chart | address | barcode) for patient-label.php.
     *
     * @return array<string, mixed>
     */
    public function buildLabelPayload(int $pid, string $type, int $actorUserId): array
    {
        $this->assertEnabled();
        if (!in_array($type, self::LABEL_TYPES, true)) {
            throw new \InvalidArgumentException('Unknown label type');
        }
        $this->getFacilityScope()->assertPatientAccessible($pid);

        $patient = QueryUtils::querySingleRow(
            "SELECT fname, mname, lname, pubpid, DOB, street, city, state, postal_code
             FROM patient_data WHERE pid = ? LIMIT 1",
            [$pid]
        );
        if (!is_array($patient)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        $payload = [
            'type' => $type,
            'pid' => $pid,
            'display_name' => trim((string) $patient['fname'] . ' ' . (string) $patient['lname']),
            'pubpid' => (string) ($patient['pubpid'] ?? ''),
            'dob' => oeFormatShortDate((string) ($patient['DOB'] ?? '')),
            'today' => oeFormatShortDate(date('Y-m-d')),
            'street' => (string) ($patient['street'] ?? ''),
            'city_line' => trim(implode(', ', array_filter([
                (string) ($patient['city'] ?? ''),
                (string) ($patient['state'] ?? ''),
            ]))) . ' ' . (string) ($patient['postal_code'] ?? ''),
            'barcode_data_uri' => null,
        ];

        if ($type === 'barcode') {
            $payload['barcode_data_uri'] = $this->renderBarcodePng((string) ($patient['pubpid'] ?? ''));
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.label_printed type=' . $type . ' pid=' . $pid
        );

        return $payload;
    }

    /**
     * Code 128 barcode of the MRN as a PNG data URI, via the core-vendored
     * Barcode class (library/classes/php-barcode.php) on a GD canvas — no
     * FPDF dependency, prints fine from a plain HTML view.
     */
    private function renderBarcodePng(string $code): ?string
    {
        $code = trim($code);
        if ($code === '' || !function_exists('imagecreatetruecolor') || !class_exists(\Barcode::class)) {
            return null;
        }

        $width = 400;
        $height = 120;
        $im = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($im, 255, 255, 255);
        $black = imagecolorallocate($im, 0, 0, 0);
        imagefilledrectangle($im, 0, 0, $width - 1, $height - 1, $white);

        try {
            \Barcode::gd($im, $black, $width / 2, $height / 2, 0, 'code128', ['code' => $code], 2, 90);
        } catch (\Throwable) {
            imagedestroy($im);

            return null;
        }

        ob_start();
        imagepng($im);
        $png = (string) ob_get_clean();
        imagedestroy($im);

        return 'data:image/png;base64,' . base64_encode($png);
    }

    /**
     * Validated context for letter-print.php (POSTed, CSRF-checked by the page).
     *
     * @return array<string, mixed>
     */
    public function buildLetterPrintContext(int $pid, string $body, int $actorUserId): array
    {
        $this->assertEnabled();
        $this->getFacilityScope()->assertPatientAccessible($pid);

        $body = trim($body);
        if ($body === '') {
            throw new \InvalidArgumentException('Letter body is empty');
        }
        if (mb_strlen($body) > 20000) {
            throw new \InvalidArgumentException('Letter body is too long');
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.letter_printed pid=' . $pid
        );

        return [
            'body' => $body,
            'pid' => $pid,
        ];
    }
}

<?php

/**
 * Shared server-side validation for user-typed identity/profile fields
 *
 * Collects per-field errors so forms can highlight inline without wiping
 * (module UX rule); throw with throwIfInvalid(). Validation here is
 * defense-in-depth on top of parameterized queries and output escaping —
 * never a substitute for either.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Exceptions\InputValidationException;

class InputValidator
{
    /** Person-name parts: letters (any script) plus space, hyphen, apostrophe, period. */
    private const NAME_PATTERN = "/^[\\p{L}][\\p{L}\\p{M}' .\\-]*$/u";

    private const USERNAME_PATTERN = '/^[a-zA-Z0-9._\-]{3,32}$/';

    private const NATIONAL_ID_PATTERN = '#^[A-Za-z0-9/ \-]{1,30}$#';

    /** Raw phone as typed: digits with common separators, before normalization. */
    private const PHONE_INPUT_PATTERN = '/^\+?[0-9 ().\-]{3,32}$/';

    public const NAME_MAX = 63;
    public const FREE_TEXT_MAX = 255;
    public const EMAIL_MAX = 190;

    /** @var array<string, string> */
    private array $errors = [];

    /**
     * Person-name part (fname, lname, contact name). Returns the trimmed value.
     */
    public function name(string $field, mixed $value, bool $required = false, int $maxLength = self::NAME_MAX): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        if (mb_strlen($value) > $maxLength) {
            $this->errors[$field] = 'Must be ' . $maxLength . ' characters or fewer';
            return $value;
        }
        if (!preg_match(self::NAME_PATTERN, $value)) {
            $this->errors[$field] = "Only letters, spaces, hyphens, apostrophes and periods are allowed";
        }
        return $value;
    }

    /**
     * Free text that ends up on screens or printouts (street, landmark,
     * nationality, relationship…). Rejects anything that looks like markup
     * rather than silently stripping it — the user should see what saved.
     */
    public function freeText(
        string $field,
        mixed $value,
        bool $required = false,
        int $maxLength = self::FREE_TEXT_MAX
    ): string {
        $value = trim((string) $value);
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        if (mb_strlen($value) > $maxLength) {
            $this->errors[$field] = 'Must be ' . $maxLength . ' characters or fewer';
            return $value;
        }
        if ($value !== strip_tags($value) || preg_match('/[<>]/', $value)) {
            $this->errors[$field] = 'Must not contain HTML or the characters < >';
        }
        return $value;
    }

    /**
     * Phone number as typed (pre-normalization shape check + length cap).
     */
    public function phone(string $field, mixed $value, bool $required = false): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        if (!preg_match(self::PHONE_INPUT_PATTERN, $value)) {
            $this->errors[$field] = 'Enter digits only (spaces, dashes and a leading + are fine)';
        }
        return $value;
    }

    public function email(string $field, mixed $value, bool $required = false): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        if (mb_strlen($value) > self::EMAIL_MAX || filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            $this->errors[$field] = 'Enter a valid email address';
        }
        return $value;
    }

    public function username(string $field, mixed $value, bool $required = true): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        if (!preg_match(self::USERNAME_PATTERN, $value)) {
            $this->errors[$field] = '3–32 characters: letters, numbers, dot, dash or underscore';
        }
        return $value;
    }

    public function nationalId(string $field, mixed $value): string
    {
        $value = trim((string) $value);
        if ($value !== '' && !preg_match(self::NATIONAL_ID_PATTERN, $value)) {
            $this->errors[$field] = 'Up to 30 characters: letters, numbers, dashes or slashes';
        }
        return $value;
    }

    /**
     * Date of birth: Y-m-d, a real calendar date, not in the future, age ≤ 130.
     */
    public function dob(string $field, mixed $value, bool $required = false): string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '0000-00-00') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return '';
        }
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if ($parsed === false || $parsed->format('Y-m-d') !== $value) {
            $this->errors[$field] = 'Enter a valid date (YYYY-MM-DD)';
            return $value;
        }
        $today = new \DateTimeImmutable('today');
        if ($parsed > $today) {
            $this->errors[$field] = 'Date of birth cannot be in the future';
        } elseif ((int) $parsed->diff($today)->y > 130) {
            $this->errors[$field] = 'Check the year — age would be over 130';
        }
        return $value;
    }

    public function ageYears(string $field, mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $age = (int) $value;
        if ($age < 0 || $age > 130) {
            $this->errors[$field] = 'Age must be between 0 and 130';
        }
        return $age;
    }

    public function addError(string $field, string $message): void
    {
        $this->errors[$field] = $message;
    }

    public function isValid(): bool
    {
        return $this->errors === [];
    }

    /**
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    public function throwIfInvalid(string $message = 'Please correct the highlighted fields'): void
    {
        if ($this->errors !== []) {
            throw new InputValidationException($this->errors, $message);
        }
    }
}

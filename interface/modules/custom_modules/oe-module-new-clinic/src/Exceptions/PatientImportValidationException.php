<?php

/**
 * Patient import row: core PatientValidator (or another validation-shaped)
 * rejection at insert time. Unlike a generic \RuntimeException from a real
 * SQL/DB failure, this message is user-actionable and safe to show as-is in
 * the per-row commit report (MKT-MIG-1 audit amendment, Task D).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

class PatientImportValidationException extends \InvalidArgumentException
{
}

<?php

/**
 * Four-section front desk registration form (M1b)
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
use OpenEMR\Services\PatientService;

class PatientRegistrationService
{
    /** @var array<string, int|string> NOT NULL columns — explicit NULL in INSERT bypasses MySQL DEFAULT */
    private const META_NOT_NULL_DEFAULTS = [
        'dob_estimated' => 0,
        'disability_flag' => 0,
        'insurance_type' => 'cash',
    ];

    /** @var list<string> */
    private const REACH_CONTACT_RELATIONSHIPS = ['neighbor', 'parent', 'spouse', 'guardian', 'relative', 'other'];

    /** @var list<string> */
    private const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

    /** @var list<string> */
    private const PREGNANCY_STATUSES = ['Not pregnant', 'Pregnant', 'Unknown'];

    /** @var list<string> */
    private const EDUCATION_LEVELS = [
        'Never went to school',
        'Primary school',
        'Finished high school',
        'Learned a trade / Technical certificate',
        'Some college or university',
        'University degree',
        "Higher university degree (Master's or PhD)",
    ];

    /** @var list<string> */
    private const RELIGIONS = [
        'Christianity',
        'Islam',
        'Traditional African religion',
        'Hinduism',
        'Buddhism',
        'Other',
        'None',
        'Unknown',
    ];

    /** @var list<string> */
    private const RACES = [
        'Black',
        'African',
        'White',
        'Asian',
        'Mixed / Multiracial',
        'Other',
        'Unknown',
    ];

    private const ALLERGY_UNKNOWN_TITLE = 'Allergies unknown';

    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PatientDuplicateService $duplicateService = new PatientDuplicateService(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly GeoService $geoService = new GeoService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getFormData(int $pid): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $patientService = new PatientService();
        $patient = $patientService->findByPid($pid);
        if (empty($patient)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        $meta = $this->loadMeta($pid);
        $dobEstimated = (int) ($meta['dob_estimated'] ?? 0) === 1;
        $allergies = $this->loadListTitles($pid, 'allergy');
        $chronic = $this->loadListTitles($pid, 'medical_problem');
        $nkdaOnly = $this->hasNkdaOnlyAllergies($allergies);
        $allergiesUnknownOnly = $this->hasAllergiesUnknownOnly($allergies);
        $insuranceMeta = array_merge($meta, [
            'insurance_type' => (string) ($meta['insurance_type'] ?? 'cash'),
            'nhis_number' => (string) ($meta['nhis_number'] ?? ''),
            'nhis_expiry' => (string) ($meta['nhis_expiry'] ?? ''),
        ]);

        return [
            'pid' => $pid,
            'pubpid' => (string) ($patient['pubpid'] ?? ''),
            'section_1' => [
                'fname' => (string) ($patient['fname'] ?? ''),
                'lname' => (string) ($patient['lname'] ?? ''),
                'mname' => (string) ($patient['mname'] ?? ''),
                'sex' => (string) ($patient['sex'] ?? ''),
                'phone' => (string) ($patient['phone_cell'] ?? ''),
                'no_phone' => trim((string) ($patient['phone_cell'] ?? '')) === ''
                    && (
                        trim((string) ($meta['reach_contact_phone'] ?? '')) !== ''
                        || trim((string) ($meta['no_phone_reason'] ?? '')) !== ''
                    ),
                'national_id' => (string) ($patient['ss'] ?? ''),
                'reach_contact_name' => (string) ($meta['reach_contact_name'] ?? ''),
                'reach_contact_phone' => (string) ($meta['reach_contact_phone'] ?? ''),
                'reach_contact_relationship' => (string) ($meta['reach_contact_relationship'] ?? ''),
                'DOB' => $dobEstimated ? '' : (string) ($patient['DOB'] ?? ''),
                'age_years' => $this->estimatedAgeYears($patient, $meta),
            ],
            'section_2' => [
                'street' => (string) ($patient['street'] ?? ''),
                'landmark' => (string) ($meta['landmark'] ?? ''),
                'nationality' => (string) ($meta['nationality'] ?? ''),
                'region_code' => (string) ($meta['region_code'] ?? ''),
                'district_code' => (string) ($meta['district_code'] ?? ''),
                'place_of_birth' => (string) ($meta['place_of_birth'] ?? ''),
                'tribe' => (string) ($meta['tribe'] ?? ''),
                'national_id' => (string) ($patient['ss'] ?? ''),
                'phone_home' => (string) ($patient['phone_home'] ?? ''),
                'email' => (string) ($patient['email'] ?? ''),
                'emergency_contact_name' => (string) ($meta['emergency_contact_name'] ?? ''),
                'emergency_contact_phone' => (string) ($meta['emergency_contact_phone'] ?? ''),
            ],
            'section_3' => [
                'blood_group' => (string) ($meta['blood_group'] ?? ''),
                'allergies_none_known' => $nkdaOnly,
                'allergies_unknown' => $allergiesUnknownOnly,
                'allergies' => ($nkdaOnly || $allergiesUnknownOnly) ? [] : $allergies,
                'chronic_conditions' => $chronic,
                'pregnancy_status' => (string) ($meta['pregnancy_status'] ?? ''),
                'disability_flag' => (int) ($meta['disability_flag'] ?? 0) === 1,
                'religion' => (string) ($meta['religion'] ?? ''),
                'race' => (string) ($meta['race'] ?? ''),
                'education_level' => (string) ($meta['education_level'] ?? ''),
                'occupation' => (string) ($meta['occupation'] ?? ''),
            ],
            'section_4' => [
                'insurance_type' => (string) ($meta['insurance_type'] ?? 'cash'),
                'insurance_effective' => PatientInsuranceUtil::effectiveType($insuranceMeta),
                'insurance_label' => PatientInsuranceUtil::displayLabel($insuranceMeta),
                'nhis_number' => (string) ($meta['nhis_number'] ?? ''),
                'nhis_expiry' => (string) ($meta['nhis_expiry'] ?? ''),
                'private_insurer' => (string) ($meta['private_insurer'] ?? ''),
                'private_policy' => (string) ($meta['private_policy'] ?? ''),
            ],
            'completion' => $this->completionService->snapshot($pid, true),
            'completion_by_level' => $this->completionService->checklistByLevel($pid, true),
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array{pid: int, pubpid: string, completion_score: int, completion_missing: array<int, string>, section: int}
     */
    public function saveSection(int $section, array $input, ?int $pid, int $actorUserId): array
    {
        if ($section < 1 || $section > 4) {
            throw new \InvalidArgumentException('Invalid registration section');
        }

        if ($pid !== null) {
            $this->facilityScope->assertPatientAccessible($pid);
        }

        if ($section === 1 && $pid === null) {
            $pid = $this->createSectionOne($input, $actorUserId);
        } elseif ($pid === null) {
            throw new \InvalidArgumentException('Patient must be created in section 1 first');
        } else {
            match ($section) {
                1 => $this->updateSectionOne($pid, $input, $actorUserId),
                2 => $this->saveSectionTwo($pid, $input),
                3 => $this->saveSectionThree($pid, $input),
                4 => $this->saveSectionFour($pid, $input),
            };
        }

        $completion = $this->completionService->recompute($pid);
        $row = QueryUtils::querySingleRow("SELECT pubpid FROM patient_data WHERE pid = ?", [$pid]);

        return [
            'pid' => $pid,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'completion_score' => (int) ($completion['score'] ?? 0),
            'completion_missing' => $completion['missing'] ?? [],
            'section' => $section,
        ];
    }

    /**
     * @param array<string, mixed> $input
     */
    private function createSectionOne(array $input, int $actorUserId): int
    {
        $fields = $this->parseSectionOneFields($input);
        $this->assertSectionOneIdentity($fields);

        $dupFields = $this->dupFieldsFromSectionOne($fields);
        $this->assertDupPolicy($input, $dupFields, $actorUserId);

        $patientData = [
            'fname' => $fields['fname'],
            'lname' => $fields['lname'],
            'mname' => $fields['mname'],
            'sex' => $fields['sex'],
            'DOB' => $fields['dob'],
            'phone_cell' => $fields['normalized_phone'] !== '' ? $fields['normalized_phone'] : '',
            'country_code' => 'GH',
        ];
        if ($fields['national_id'] !== '') {
            $patientData['ss'] = $fields['national_id'];
        }

        $patientService = new PatientService();
        $result = $patientService->insert($patientData);
        if (!$result->isValid() || !$result->hasData()) {
            throw new \InvalidArgumentException('Could not create patient');
        }

        $pid = (int) $result->getFirstDataResult()['pid'];
        $this->afterPatientWrite($pid, $fields);

        return $pid;
    }

    /**
     * @param array<string, mixed> $input
     */
    private function updateSectionOne(int $pid, array $input, int $actorUserId): void
    {
        $fields = $this->parseSectionOneFields($input);
        $this->assertSectionOneIdentity($fields);

        $meta = $this->loadMeta($pid);
        if ($fields['dob'] === '' && $fields['age_years'] !== null) {
            $fields['dob'] = sprintf('%04d-07-01', (int) date('Y') - $fields['age_years']);
            $fields['dob_estimated'] = 1;
        } elseif ($fields['dob'] !== '' && $fields['dob'] !== '0000-00-00') {
            $fields['dob_estimated'] = 0;
        } else {
            $fields['dob_estimated'] = (int) ($meta['dob_estimated'] ?? 0);
            $existing = (new PatientService())->findByPid($pid);
            if ($fields['dob'] === '' && !empty($existing['DOB'])) {
                $fields['dob'] = (string) $existing['DOB'];
            }
        }

        $dupFields = $this->dupFieldsFromSectionOne($fields);
        $this->assertDupPolicy($input, $dupFields, $actorUserId, $pid);

        $patientUpdate = [
            'pid' => $pid,
            'fname' => $fields['fname'],
            'lname' => $fields['lname'],
            'mname' => $fields['mname'],
            'sex' => $fields['sex'],
            'DOB' => $fields['dob'] !== '' ? $fields['dob'] : null,
            'phone_cell' => $fields['normalized_phone'],
        ];
        if ($fields['national_id'] !== '') {
            $patientUpdate['ss'] = $fields['national_id'];
        }
        $this->updatePatient($pid, $patientUpdate);

        if ($fields['normalized_phone'] !== '') {
            QueryUtils::sqlInsert(
                "UPDATE patient_data SET phone_normalized = ? WHERE pid = ?",
                [$fields['normalized_phone'], $pid]
            );
        }

        $this->upsertMeta($pid, [
            'dob_estimated' => $fields['dob_estimated'],
            'no_phone_reason' => null,
            'reach_contact_name' => $fields['no_phone'] && $fields['reach_contact_name'] !== ''
                ? $fields['reach_contact_name'] : null,
            'reach_contact_phone' => $fields['no_phone'] && $fields['normalized_reach_phone'] !== ''
                ? $fields['normalized_reach_phone'] : null,
            'reach_contact_relationship' => $fields['no_phone'] && $fields['reach_contact_relationship'] !== ''
                ? $fields['reach_contact_relationship'] : null,
        ]);

        require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
        updateDupScore($pid);
    }

    /**
     * @param array<string, mixed> $input
     */
    private function saveSectionTwo(int $pid, array $input): void
    {
        $v = new InputValidator();
        $regionCode = strtoupper(trim((string) ($input['region_code'] ?? '')));
        $districtCode = strtoupper(trim((string) ($input['district_code'] ?? '')));
        $street = $v->freeText('street', $input['street'] ?? '');
        $landmark = $v->freeText('landmark', $input['landmark'] ?? '');
        $email = $v->email('email', $input['email'] ?? '');
        $nationalId = $v->nationalId('national_id', $input['national_id'] ?? '');
        $v->phone('phone_home', $input['phone_home'] ?? '');
        $v->phone('emergency_contact_phone', $input['emergency_contact_phone'] ?? '');
        $v->freeText('nationality', $input['nationality'] ?? '', false, InputValidator::NAME_MAX);
        $v->freeText('place_of_birth', $input['place_of_birth'] ?? '');
        $v->freeText('tribe', $input['tribe'] ?? '', false, InputValidator::NAME_MAX);
        $v->name('emergency_contact_name', $input['emergency_contact_name'] ?? '');
        $v->throwIfInvalid();

        $phoneHome = $this->phoneNormalizer->normalize((string) ($input['phone_home'] ?? ''));
        $emergencyPhone = $this->phoneNormalizer->normalize((string) ($input['emergency_contact_phone'] ?? ''));

        $this->assertValidEmail($email);
        if ($phoneHome !== '') {
            $this->assertPhoneFormat($phoneHome);
        }
        if ($emergencyPhone !== '') {
            $this->assertPhoneFormat($emergencyPhone);
        }

        $hasLocationInput = $street !== '' || $landmark !== '' || $regionCode !== '' || $districtCode !== '';
        if (($regionCode !== '') xor ($districtCode !== '')) {
            throw new \InvalidArgumentException('Select both region and district, or leave both empty');
        }

        $regionLabel = '';
        $districtLabel = '';
        if ($hasLocationInput) {
            if ($regionCode === '' || $this->geoService->regionLabel($regionCode) === '') {
                throw new \InvalidArgumentException('Region is required when address or location is provided');
            }
            if ($districtCode === '' || !$this->geoService->validateDistrictInRegion($regionCode, $districtCode)) {
                throw new \InvalidArgumentException('District is required and must match the selected region');
            }
            $regionLabel = $this->geoService->regionLabel($regionCode);
            $districtLabel = $this->geoService->districtLabel($regionCode, $districtCode);
        }

        $nationality = trim((string) ($input['nationality'] ?? ''));
        $placeOfBirth = trim((string) ($input['place_of_birth'] ?? ''));
        $tribe = trim((string) ($input['tribe'] ?? ''));
        $emergencyName = trim((string) ($input['emergency_contact_name'] ?? ''));

        $patientUpdate = [
            'pid' => $pid,
            'street' => $street,
            'ss' => $nationalId,
            'phone_home' => $phoneHome,
            'email' => $email,
        ];
        if ($hasLocationInput) {
            $patientUpdate['state'] = $regionLabel;
            $patientUpdate['city'] = $districtLabel;
        }

        $metaUpdate = [
            'landmark' => $landmark !== '' ? $landmark : null,
            'nationality' => $nationality !== '' ? $nationality : null,
            'place_of_birth' => $placeOfBirth !== '' ? $placeOfBirth : null,
            'tribe' => $tribe !== '' ? $tribe : null,
            'emergency_contact_name' => $emergencyName !== '' ? $emergencyName : null,
            'emergency_contact_phone' => $emergencyPhone !== '' ? $emergencyPhone : null,
        ];
        if ($hasLocationInput) {
            $metaUpdate['region_code'] = $regionCode;
            $metaUpdate['region_label'] = $regionLabel;
            $metaUpdate['district_code'] = $districtCode;
            $metaUpdate['district_label'] = $districtLabel;
        }

        $this->updatePatient($pid, $patientUpdate);
        $this->upsertMeta($pid, $metaUpdate);
    }

    /**
     * @param array<string, mixed> $input
     */
    private function saveSectionThree(int $pid, array $input): void
    {
        $patient = (new PatientService())->findByPid($pid);
        $sex = strtolower((string) ($patient['sex'] ?? ''));
        $pregnancy = trim((string) ($input['pregnancy_status'] ?? ''));
        if ($sex !== 'female') {
            $pregnancy = '';
        } elseif ($pregnancy !== '' && !in_array($pregnancy, self::PREGNANCY_STATUSES, true)) {
            throw new \InvalidArgumentException('Invalid pregnancy status');
        }

        $bloodGroup = trim((string) ($input['blood_group'] ?? ''));
        if ($bloodGroup !== '' && !in_array($bloodGroup, self::BLOOD_GROUPS, true)) {
            throw new \InvalidArgumentException('Invalid blood group');
        }

        $religion = trim((string) ($input['religion'] ?? ''));
        $race = trim((string) ($input['race'] ?? ''));
        if ($race === 'Black / African') {
            $race = '';
        }
        $educationLevel = trim((string) ($input['education_level'] ?? ''));
        $this->assertOptionalEnum($religion, self::RELIGIONS, 'religion');
        $this->assertOptionalEnum($race, self::RACES, 'race');
        $this->assertOptionalEnum($educationLevel, self::EDUCATION_LEVELS, 'education level');

        $this->upsertMeta($pid, [
            'blood_group' => $bloodGroup !== '' ? $bloodGroup : null,
            'pregnancy_status' => $pregnancy !== '' ? $pregnancy : null,
            'disability_flag' => !empty($input['disability_flag']) ? 1 : 0,
            'religion' => $religion !== '' ? $religion : null,
            'race' => $race !== '' ? $race : null,
            'education_level' => $educationLevel !== '' ? $educationLevel : null,
            'occupation' => trim((string) ($input['occupation'] ?? '')) !== ''
                ? trim((string) ($input['occupation'] ?? '')) : null,
        ]);

        $noneKnown = !empty($input['allergies_none_known']);
        $allergiesUnknown = !empty($input['allergies_unknown']);
        if ($noneKnown && $allergiesUnknown) {
            throw new \InvalidArgumentException('Choose either no known allergies or allergies unknown, not both');
        }

        $allergyTags = $this->normalizeTags($input['allergies'] ?? []);
        if ($allergiesUnknown) {
            $this->replaceListEntries($pid, 'allergy', [self::ALLERGY_UNKNOWN_TITLE]);
        } elseif ($noneKnown) {
            $this->replaceListEntries($pid, 'allergy', ['None known']);
        } else {
            $this->replaceListEntries($pid, 'allergy', $allergyTags);
        }

        $chronicTags = $this->normalizeTags($input['chronic_conditions'] ?? []);
        $this->replaceListEntries($pid, 'medical_problem', $chronicTags);
    }

    /**
     * @param array<string, mixed> $input
     */
    private function saveSectionFour(int $pid, array $input): void
    {
        $type = strtolower(trim((string) ($input['insurance_type'] ?? 'cash')));
        if (!in_array($type, ['cash', 'nhis', 'private'], true)) {
            $type = 'cash';
        }

        $nhisNumber = trim((string) ($input['nhis_number'] ?? ''));
        $nhisExpiry = trim((string) ($input['nhis_expiry'] ?? ''));
        $privateInsurer = trim((string) ($input['private_insurer'] ?? ''));
        $privatePolicy = trim((string) ($input['private_policy'] ?? ''));

        if ($type !== 'nhis') {
            $nhisNumber = '';
            $nhisExpiry = '';
        }
        if ($type !== 'private') {
            $privateInsurer = '';
            $privatePolicy = '';
        }

        $this->upsertMeta($pid, [
            'insurance_type' => $type,
            'nhis_number' => $nhisNumber !== '' ? $nhisNumber : null,
            'nhis_expiry' => $nhisExpiry !== '' ? $nhisExpiry : null,
            'private_insurer' => $privateInsurer !== '' ? $privateInsurer : null,
            'private_policy' => $privatePolicy !== '' ? $privatePolicy : null,
        ]);
    }

    /**
     * @param array<string, mixed> $input
     * @return array{
     *   fname: string,
     *   lname: string,
     *   mname: string,
     *   sex: string,
     *   phone: string,
     *   dob: string,
     *   age_years: ?int,
     *   dob_estimated: int,
     *   normalized_phone: string,
     *   normalized_reach_phone: string,
     *   national_id: string,
     *   no_phone: bool,
     *   reach_contact_name: string,
     *   reach_contact_relationship: string
     * }
     */
    private function parseSectionOneFields(array $input): array
    {
        // Server-side field validation — the island's inline checks are UX only.
        $v = new InputValidator();
        $fname = $v->name('fname', $input['fname'] ?? '', true);
        $lname = $v->name('lname', $input['lname'] ?? '', true);
        $mname = $v->name('mname', $input['mname'] ?? '');
        $sex = $this->normalizeSex((string) ($input['sex'] ?? ''));
        $phone = $v->phone('phone', $input['phone'] ?? '');
        $dob = $v->dob('DOB', $input['DOB'] ?? '');
        $ageYears = $v->ageYears('age_years', $input['age_years'] ?? null);
        $noPhone = !empty($input['no_phone']);
        $reachContactName = $v->name('reach_contact_name', $input['reach_contact_name'] ?? '');
        $reachContactPhone = $v->phone('reach_contact_phone', $input['reach_contact_phone'] ?? '');
        $reachContactRelationship = $v->freeText(
            'reach_contact_relationship',
            $input['reach_contact_relationship'] ?? '',
            false,
            InputValidator::NAME_MAX
        );
        $nationalId = $v->nationalId('national_id', $input['national_id'] ?? '');
        $v->throwIfInvalid();
        $dobEstimated = 0;

        if ($dob === '' && $ageYears !== null) {
            $dob = sprintf('%04d-07-01', (int) date('Y') - $ageYears);
            $dobEstimated = 1;
        } elseif ($dob !== '' && $dob !== '0000-00-00') {
            $dobEstimated = 0;
        }

        $normalizedPhone = $noPhone ? '' : $this->phoneNormalizer->normalize($phone);
        $normalizedReachPhone = $this->phoneNormalizer->normalize($reachContactPhone);

        return [
            'fname' => $fname,
            'lname' => $lname,
            'mname' => $mname,
            'sex' => $sex,
            'phone' => $phone,
            'no_phone' => $noPhone,
            'reach_contact_name' => $reachContactName,
            'reach_contact_relationship' => $reachContactRelationship,
            'dob' => $dob,
            'age_years' => $ageYears,
            'dob_estimated' => $dobEstimated,
            'normalized_phone' => $normalizedPhone,
            'normalized_reach_phone' => $normalizedReachPhone,
            'national_id' => $nationalId,
        ];
    }

    /**
     * @param array<string, mixed> $fields
     * @return array<string, string>
     */
    private function dupFieldsFromSectionOne(array $fields): array
    {
        $phoneForDup = $fields['normalized_phone'] !== ''
            ? $fields['normalized_phone']
            : $fields['normalized_reach_phone'];

        return [
            'fname' => $fields['fname'],
            'lname' => $fields['lname'],
            'sex' => $fields['sex'],
            'DOB' => $fields['dob'],
            'phone' => $phoneForDup,
            'national_id' => $fields['national_id'],
        ];
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function afterPatientWrite(int $pid, array $fields): void
    {
        if ($fields['normalized_phone'] !== '') {
            QueryUtils::sqlInsert(
                "UPDATE patient_data SET phone_normalized = ? WHERE pid = ?",
                [$fields['normalized_phone'], $pid]
            );
        }

        require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
        updateDupScore($pid);

        $this->upsertMeta($pid, [
            'dob_estimated' => $fields['dob_estimated'],
            'no_phone_reason' => null,
            'reach_contact_name' => $fields['no_phone'] && $fields['reach_contact_name'] !== ''
                ? $fields['reach_contact_name'] : null,
            'reach_contact_phone' => $fields['no_phone'] && $fields['normalized_reach_phone'] !== ''
                ? $fields['normalized_reach_phone'] : null,
            'reach_contact_relationship' => $fields['no_phone'] && $fields['reach_contact_relationship'] !== ''
                ? $fields['reach_contact_relationship'] : null,
        ]);
    }

    /**
     * @param array<string, mixed> $input
     * @param array<string, mixed> $fields
     */
    private function assertDupPolicy(array $input, array $fields, int $actorUserId, ?int $excludePid = null): void
    {
        $dup = $this->duplicateService->scoreProspect($fields, $excludePid);
        $dupOverride = !empty($input['dup_override']);
        $dupOverrideReason = trim((string) ($input['dup_override_reason'] ?? ''));

        if ($dup['level'] === 'block' && !$dupOverride) {
            throw new \InvalidArgumentException('Likely duplicate patient — use existing record or override');
        }

        if ($dup['level'] === 'warn' && empty($input['dup_confirm'])) {
            throw new \InvalidArgumentException('Confirm this is a different patient');
        }

        if ($dup['level'] === 'block' && $dupOverride) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_create_despite_dup')) {
                throw new \InvalidArgumentException('Duplicate override not permitted for this user');
            }
            if ($dupOverrideReason === '') {
                throw new \InvalidArgumentException('Duplicate override reason is required');
            }

            EventAuditLogger::getInstance()->newEvent(
                'new_patient',
                $_SESSION['authUser'] ?? 'system',
                $_SESSION['authProvider'] ?? 'default',
                'dup_override',
                json_encode([
                    'candidates' => $dup['candidates'],
                    'reason' => $dupOverrideReason,
                    'actor_user_id' => $actorUserId,
                ]),
                0
            );
        }
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function assertSectionOneIdentity(array $fields): void
    {
        $fname = (string) ($fields['fname'] ?? '');
        $lname = (string) ($fields['lname'] ?? '');
        $sex = (string) ($fields['sex'] ?? '');
        $dob = (string) ($fields['dob'] ?? '');
        $ageYears = $fields['age_years'] ?? null;
        $noPhone = !empty($fields['no_phone']);
        $normalizedPhone = (string) ($fields['normalized_phone'] ?? '');
        $normalizedReachPhone = (string) ($fields['normalized_reach_phone'] ?? '');
        $reachContactName = (string) ($fields['reach_contact_name'] ?? '');
        $reachContactRelationship = (string) ($fields['reach_contact_relationship'] ?? '');

        if ($fname === '' || strlen($lname) < 2 || $sex === '') {
            throw new \InvalidArgumentException('First name, last name (min 2 chars), and sex are required');
        }

        if ($dob === '' && ($ageYears === null || $ageYears < 0)) {
            throw new \InvalidArgumentException('Date of birth or estimated age is required');
        }

        if ($ageYears !== null && ($ageYears < 0 || $ageYears > 130)) {
            throw new \InvalidArgumentException('Estimated age must be between 0 and 130');
        }

        if ($noPhone) {
            if ($reachContactName === '' || $normalizedReachPhone === '') {
                throw new \InvalidArgumentException('Reach contact name and phone are required when patient has no personal phone');
            }
            if ($reachContactRelationship === ''
                || !in_array($reachContactRelationship, self::REACH_CONTACT_RELATIONSHIPS, true)) {
                throw new \InvalidArgumentException('Reach contact relationship is required');
            }
            $this->assertPhoneFormat($normalizedReachPhone);

            return;
        }

        if ($normalizedPhone === '') {
            throw new \InvalidArgumentException('Phone is required, or check no personal phone and add a reach contact');
        }

        $this->assertPhoneFormat($normalizedPhone);
    }

    private function assertPhoneFormat(string $normalizedPhone): void
    {
        $pattern = $this->safePhoneRegex(
            (string) ($this->config->get('phone_validation_regex', '^0[235]\d{8}$') ?? '^0[235]\d{8}$')
        );
        if (@preg_match('/' . $pattern . '/', $normalizedPhone) !== 1) {
            throw new \InvalidArgumentException('Phone format is invalid');
        }
    }

    private function assertValidEmail(string $email): void
    {
        if ($email === '') {
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Email format is invalid');
        }
    }

    /**
     * @param list<string> $allowed
     */
    private function assertOptionalEnum(string $value, array $allowed, string $label): void
    {
        if ($value === '') {
            return;
        }

        if (!in_array($value, $allowed, true)) {
            throw new \InvalidArgumentException('Invalid ' . $label);
        }
    }

    private function safePhoneRegex(string $pattern): string
    {
        if ($pattern === '' || strlen($pattern) > 64) {
            return '^0[235]\d{8}$';
        }

        if (@preg_match('/' . $pattern . '/', '') === false) {
            return '^0[235]\d{8}$';
        }

        return $pattern;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function updatePatient(int $pid, array $data): void
    {
        $data['pid'] = $pid;
        $patientService = new PatientService();
        $updated = $patientService->databaseUpdate($data);
        if ($updated === false) {
            throw new \InvalidArgumentException('Could not update patient');
        }
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function upsertMeta(int $pid, array $fields): void
    {
        $existing = $this->loadMeta($pid);
        $merged = array_merge($existing ?: [], $fields);
        $merged['pid'] = $pid;

        $columns = [
            'dob_estimated', 'no_phone_reason', 'reach_contact_name', 'reach_contact_phone', 'reach_contact_relationship',
            'region_code', 'region_label', 'district_code', 'district_label',
            'landmark', 'emergency_contact_name', 'emergency_contact_phone', 'blood_group', 'disability_flag',
            'pregnancy_status', 'insurance_type', 'nhis_number', 'nhis_expiry', 'private_insurer', 'private_policy',
            'nationality', 'place_of_birth', 'tribe', 'religion', 'race', 'education_level', 'occupation',
        ];

        if (empty($existing)) {
            $placeholders = implode(', ', array_fill(0, count($columns) + 1, '?'));
            $colList = 'pid, ' . implode(', ', $columns);
            $values = [$pid];
            foreach ($columns as $column) {
                $values[] = $this->coerceMetaColumnValue($column, $merged[$column] ?? null);
            }
            QueryUtils::sqlInsert(
                "INSERT INTO new_patient_meta ($colList) VALUES ($placeholders)",
                $values
            );

            return;
        }

        $sets = [];
        $bind = [];
        foreach ($columns as $column) {
            if (!is_array($fields) || !array_key_exists($column, $fields)) {
                continue;
            }
            $sets[] = "`$column` = ?";
            $bind[] = $fields[$column];
        }
        if ($sets === []) {
            return;
        }

        $bind[] = $pid;
        QueryUtils::sqlInsert(
            'UPDATE new_patient_meta SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE pid = ?',
            $bind
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function loadMeta(int $pid): array
    {
        $row = QueryUtils::querySingleRow("SELECT * FROM new_patient_meta WHERE pid = ?", [$pid]);

        return is_array($row) ? $row : [];
    }

    private function coerceMetaColumnValue(string $column, mixed $value): mixed
    {
        if ($value !== null && $value !== '') {
            return $value;
        }

        return self::META_NOT_NULL_DEFAULTS[$column] ?? null;
    }

    /**
     * @return array<int, string>
     */
    private function loadListTitles(int $pid, string $type): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = ? AND activity = 1 ORDER BY id ASC",
            [$pid, $type]
        ) ?: [];

        $titles = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title !== '') {
                $titles[] = $title;
            }
        }

        return $titles;
    }

    /**
     * @param array<int, string> $titles
     */
    private function hasNkdaOnlyAllergies(array $titles): bool
    {
        if (count($titles) !== 1) {
            return false;
        }

        return PatientCompletionService::isNkdaOnlyTitle($titles[0]);
    }

    /**
     * @param array<int, string> $titles
     */
    private function hasAllergiesUnknownOnly(array $titles): bool
    {
        if (count($titles) !== 1) {
            return false;
        }

        return PatientCompletionService::isAllergiesUnknownTitle($titles[0]);
    }

    /**
     * @param array<int, string> $tags
     */
    private function replaceListEntries(int $pid, string $type, array $tags): void
    {
        QueryUtils::sqlInsert(
            "UPDATE lists SET activity = 0 WHERE pid = ? AND type = ?",
            [$pid, $type]
        );

        foreach ($tags as $tag) {
            $title = trim($tag);
            if ($title === '') {
                continue;
            }

            QueryUtils::sqlInsert(
                "INSERT INTO lists (date, type, activity, pid, title, begdate) VALUES (NOW(), ?, 1, ?, ?, CURDATE())",
                [$type, $pid, $title]
            );
        }
    }

    /**
     * @param mixed $value
     * @return array<int, string>
     */
    private function normalizeTags($value): array
    {
        if (is_string($value)) {
            $value = array_map('trim', explode(',', $value));
        }
        if (!is_array($value)) {
            return [];
        }

        $tags = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $tags[] = $item;
            }
        }

        return array_values(array_unique($tags));
    }

    /**
     * @param array<string, mixed> $patient
     * @param array<string, mixed> $meta
     */
    private function estimatedAgeYears(array $patient, array $meta): ?int
    {
        if ((int) ($meta['dob_estimated'] ?? 0) !== 1) {
            return null;
        }
        $dob = (string) ($patient['DOB'] ?? '');
        if ($dob === '' || $dob === '0000-00-00') {
            return null;
        }

        $birthYear = (int) substr($dob, 0, 4);

        return max(0, (int) date('Y') - $birthYear);
    }

    private function normalizeSex(string $sex): string
    {
        $map = [
            'M' => 'Male',
            'F' => 'Female',
            'O' => 'UNK',
            'Male' => 'Male',
            'Female' => 'Female',
            'Other' => 'UNK',
            'UNK' => 'UNK',
            'Unknown' => 'UNK',
        ];

        return $map[$sex] ?? '';
    }
}

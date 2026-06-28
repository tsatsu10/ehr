export const SECTION_COMPLETION_KEYS: Record<number, string[]> = {
  1: ['fname', 'lname', 'mname', 'sex', 'phone_cell', 'DOB'],
  2: ['street', 'region_code', 'district_code', 'landmark', 'national_id', 'emergency_contact', 'email'],
  3: ['allergies_documented'],
  4: ['nhis_number'],
};

export const EDUCATION_LEVELS = [
  'Never went to school',
  'Primary school',
  'Finished high school',
  'Learned a trade / Technical certificate',
  'Some college or university',
  'University degree',
  "Higher university degree (Master's or PhD)",
];

export const RELIGIONS = [
  'Christianity', 'Islam', 'Traditional African religion', 'Hinduism', 'Buddhism',
  'Other', 'None', 'Unknown',
];

export const RACES = [
  'Black', 'African', 'White', 'Asian', 'Mixed / Multiracial', 'Other', 'Unknown',
];

export const REACH_RELATIONSHIPS = [
  { value: '', label: '—' },
  { value: 'neighbor', label: 'Neighbour' },
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'relative', label: 'Relative' },
  { value: 'other', label: 'Other' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

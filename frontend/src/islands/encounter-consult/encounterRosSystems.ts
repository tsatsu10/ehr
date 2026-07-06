export const ROS_SYSTEMS = [
  'Constitutional',
  'HEENT',
  'Cardiovascular',
  'Respiratory',
  'Gastrointestinal',
  'Genitourinary',
  'Musculoskeletal',
  'Neurological',
  'Psychiatric',
  'Skin',
  'Endocrine',
  'Hematologic',
  'Allergic/Immunologic',
] as const;

export type RosSystemName = (typeof ROS_SYSTEMS)[number];

export const ROS_BRIEF_SYSTEMS: readonly RosSystemName[] = [
  'Constitutional',
  'Cardiovascular',
  'Respiratory',
  'Gastrointestinal',
  'Neurological',
];

export const ROS_FINDING_STATUSES = [
  'not_reviewed',
  'normal',
  'negative',
  'abnormal',
] as const;

export type RosFindingStatus = (typeof ROS_FINDING_STATUSES)[number];

export function rosStatusLabel(status: RosFindingStatus): string {
  switch (status) {
    case 'normal':
      return 'Normal';
    case 'negative':
      return 'Negative';
    case 'abnormal':
      return 'Abnormal';
    default:
      return 'Not reviewed';
  }
}

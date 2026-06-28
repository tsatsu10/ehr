/**
 * POST helper for doctor actions that need error payload data (e.g. encounter_unsigned).
 */

export {
  postDeskAction as postDoctorAction,
  type PostDeskActionOptions as PostDoctorActionOptions,
  type PostDeskActionResult as PostDoctorActionResult,
} from '@core/postDeskAction';

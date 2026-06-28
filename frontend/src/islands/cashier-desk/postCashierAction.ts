/**
 * POST helper preserving error payload data (e.g. encounter_unsigned on pay).
 */

export {
  postDeskAction as postCashierAction,
  type PostDeskActionOptions as PostCashierActionOptions,
  type PostDeskActionResult as PostCashierActionResult,
} from '@core/postDeskAction';

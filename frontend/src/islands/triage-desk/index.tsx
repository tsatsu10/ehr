/**
 * Triage Desk island entry — Phase 2A
 *
 * Mounted by Twig when enable_react_triage_desk = 1.
 * Props decoded from data-island="triage-desk" data-props="...".
 */

import { mountIsland } from '@core/mountIsland';
import { TriageDesk } from './TriageDesk';
import './main.css';

mountIsland('triage-desk', TriageDesk);

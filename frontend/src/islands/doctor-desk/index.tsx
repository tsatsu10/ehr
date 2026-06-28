/**
 * Doctor Desk island entry — Phase 3A
 *
 * Mounted by Twig when enable_react_doctor_desk = 1.
 */

import { mountIsland } from '@core/mountIsland';
import { DoctorDesk } from './DoctorDesk';
import './main.css';

mountIsland('doctor-desk', DoctorDesk);

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  HeartPulse,
  MessageSquare,
  Microscope,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import type { EncounterConsultSectionId } from './encounterConsultTypes';

export const ENCOUNTER_SECTION_ICONS: Record<EncounterConsultSectionId, LucideIcon> = {
  referral: UserRound,
  source: MessageSquare,
  cc: ClipboardList,
  hpi: BookOpen,
  ros: HeartPulse,
  background: BookOpen,
  vitals: Activity,
  pe: Stethoscope,
  data_reviewed: FileSearch,
  problems: ClipboardCheck,
  follow_up: CalendarClock,
  attestation: Microscope,
};

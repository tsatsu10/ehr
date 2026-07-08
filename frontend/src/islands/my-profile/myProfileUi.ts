import './main.css';

const ACCENT_CLASS: Record<string, string> = {
  reception: 'nc-my-profile-accent-reception',
  nurse: 'nc-my-profile-accent-nurse',
  doctor: 'nc-my-profile-accent-doctor',
  lab: 'nc-my-profile-accent-lab',
  pharmacy: 'nc-my-profile-accent-pharmacy',
  cashier: 'nc-my-profile-accent-cashier',
  admin: 'nc-my-profile-accent-admin',
};

export function profileAccentClass(accent: string): string {
  return ACCENT_CLASS[accent] ?? ACCENT_CLASS.admin;
}

export const ACL_HELP_INTRO = [
  'A large application like OpenEMR is used by users with varying roles. Access Control Lists (ACL) grant access to parts of the program on a need-to-know basis.',
  'Everybody is denied by default. Access is granted selectively via Access Control Objects (ACOs) grouped into categories such as Administration, Accounting, Patient Information, and Encounters.',
  'Rather than granting each ACO to each user individually, users belong to groups (AROs) such as Accounting, Administrators, Clinicians, Emergency Login, Front Office, and Physicians. Users inherit privileges from every group they belong to.',
  'When a new user is created, an administrator assigns groups. To change privileges for many users at once, use membership and group permission editors in Access & ACL.',
];

export const ACL_HELP_SECTIONS = [
  {
    id: 'user-memberships',
    title: 'User memberships',
    paragraphs: [
      'Active users are listed alphabetically by username. Select a user to see Active (member of) and Inactive (available) groups.',
      'Select groups and use Add or Remove — changes apply immediately; there is no separate Save button.',
      'Hold Shift or Ctrl to select multiple groups when using the stock UI; in Clinic Setup use checkboxes instead.',
    ],
  },
  {
    id: 'groups-access',
    title: 'Groups and access controls',
    paragraphs: [
      'Each group (ARO) has an Access Control List of ACOs. Edit group permissions to move ACOs between Active and Inactive.',
      'You can create new groups and remove existing ones from Advanced GACL. You cannot create new ACO categories from the UI.',
      'Return values (view, addonly, wsome, write) reflect how strongly a group may modify data.',
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced — finer access control',
    paragraphs: [
      'phpGACL advanced administration is for expert customization. Incorrect changes can break login or expose stock billing screens.',
      'See OpenEMR wiki: ACL Fine Granular Control for deeper documentation.',
    ],
  },
];

export const ACL_ACO_CATEGORIES: { title: string; items: string[] }[] = [
  {
    title: 'Accounting (acct)',
    items: ['Billing', 'Discount prices', 'EOB data entry', 'Financial reporting'],
  },
  {
    title: 'Administration (admin)',
    items: ['Superuser', 'Calendar', 'Database reporting', 'Forms', 'Practice settings', 'Users/groups/logs', 'ACL administration', 'Manage modules', 'Menu'],
  },
  {
    title: 'Encounter information (encounters)',
    items: ['Authorize encounters', 'Coding', 'Notes', 'Fix encounter dates', 'Relaxed information'],
  },
  {
    title: 'Patients (patients)',
    items: ['Demographics', 'Documents', 'Appointments', 'Prescriptions', 'Lab results', 'Medical history'],
  },
  {
    title: 'Lists, sensitivities, squads',
    items: ['Default/state/country lists', 'Normal/high sensitivity', 'Squad access'],
  },
];

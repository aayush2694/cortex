export interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Learn',
    items: [
      { path: '/', label: 'Dashboard', icon: 'ti-layout-dashboard', exact: true },
      { path: '/map', label: 'Knowledge map', icon: 'ti-topology-star-3' },
      { path: '/patterns', label: 'Patterns', icon: 'ti-puzzle' },
      { path: '/practice', label: 'Practice', icon: 'ti-code' },
      { path: '/review', label: 'Review', icon: 'ti-cards' },
      { path: '/visualizer', label: 'Visualizer', icon: 'ti-chart-bar' },
      { path: '/tutor', label: 'Tutor', icon: 'ti-message-circle' },
    ],
  },
  {
    title: 'Career',
    items: [
      { path: '/jobs', label: 'Job tracker', icon: 'ti-briefcase' },
      { path: '/interview', label: 'Interview prep', icon: 'ti-messages' },
      { path: '/resume-match', label: 'Resume match', icon: 'ti-file-search' },
      { path: '/offers', label: 'Offers', icon: 'ti-currency-rupee' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { path: '/cheatsheet', label: 'Cheat sheet', icon: 'ti-table' },
      { path: '/tools', label: 'Developer tools', icon: 'ti-tool' },
    ],
  },
  {
    title: 'Plan',
    items: [
      { path: '/roadmap', label: 'Roadmap', icon: 'ti-map-2' },
      { path: '/settings', label: 'Settings', icon: 'ti-settings' },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

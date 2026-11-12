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
      { path: '/visualizer', label: 'Visualizer', icon: 'ti-chart-bar' },
      { path: '/tutor', label: 'Tutor', icon: 'ti-message-circle' },
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

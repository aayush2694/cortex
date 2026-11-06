export interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'ti-layout-dashboard', exact: true },
  { path: '/map', label: 'Knowledge map', icon: 'ti-topology-star-3' },
  { path: '/visualizer', label: 'Visualizer', icon: 'ti-chart-bar' },
  { path: '/tutor', label: 'Tutor', icon: 'ti-message-circle' },
  { path: '/roadmap', label: 'Roadmap', icon: 'ti-map-2' },
];

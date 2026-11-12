import { Routes } from '@angular/router';

// Every page is lazy-loaded: the browser only downloads a page's code when you visit it.
export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · Cortex',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'map',
    title: 'Knowledge map · Cortex',
    loadComponent: () =>
      import('./features/knowledge-map/knowledge-map').then((m) => m.KnowledgeMapPage),
  },
  {
    path: 'patterns',
    title: 'Patterns · Cortex',
    loadComponent: () => import('./features/patterns/patterns').then((m) => m.Patterns),
  },
  {
    path: 'topics/:id',
    title: 'Topic · Cortex',
    loadComponent: () => import('./features/topics/topic-page').then((m) => m.TopicPage),
  },
  {
    path: 'visualizer',
    title: 'Visualizer · Cortex',
    loadComponent: () => import('./features/visualizer/visualizer').then((m) => m.Visualizer),
  },
  {
    path: 'visualizer/:key',
    title: 'Visualizer · Cortex',
    loadComponent: () => import('./features/visualizer/visualizer').then((m) => m.Visualizer),
  },
  {
    path: 'tutor',
    title: 'Tutor · Cortex',
    loadComponent: () => import('./features/tutor/tutor').then((m) => m.Tutor),
  },
  {
    path: 'tutor/:sessionId',
    title: 'Tutor · Cortex',
    loadComponent: () => import('./features/tutor/tutor').then((m) => m.Tutor),
  },
  {
    path: 'roadmap',
    title: 'Roadmap · Cortex',
    loadComponent: () => import('./features/roadmap/roadmap').then((m) => m.Roadmap),
  },
  {
    path: 'settings',
    title: 'Settings · Cortex',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: '' },
];

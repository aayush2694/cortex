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
    path: 'practice',
    title: 'Practice · Cortex',
    loadComponent: () =>
      import('./features/practice/practice-list').then((m) => m.PracticeList),
  },
  {
    path: 'practice/:id',
    title: 'Practice · Cortex',
    loadComponent: () =>
      import('./features/practice/practice-page').then((m) => m.PracticePage),
  },
  {
    path: 'review',
    title: 'Review · Cortex',
    loadComponent: () => import('./features/review/review').then((m) => m.Review),
  },
  {
    path: 'cheatsheet',
    title: 'Big-O cheat sheet · Cortex',
    loadComponent: () => import('./features/cheatsheet/cheatsheet').then((m) => m.Cheatsheet),
  },
  {
    path: 'jobs',
    title: 'Job tracker · Cortex',
    loadComponent: () => import('./features/jobs/job-board').then((m) => m.JobBoard),
  },
  {
    path: 'interview',
    title: 'Interview prep · Cortex',
    loadComponent: () => import('./features/jobs/interview-prep').then((m) => m.InterviewPrep),
  },
  {
    path: 'resume-match',
    title: 'Resume match · Cortex',
    loadComponent: () => import('./features/jobs/resume-match').then((m) => m.ResumeMatch),
  },
  {
    path: 'offers',
    title: 'Offers · Cortex',
    loadComponent: () => import('./features/jobs/offers').then((m) => m.Offers),
  },
  {
    path: 'tools',
    title: 'Developer tools · Cortex',
    loadComponent: () => import('./features/tools/tools').then((m) => m.Tools),
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

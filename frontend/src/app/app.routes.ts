import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth-guard';

// Every page is lazy-loaded: the browser only downloads a page's code when you visit it.
export const routes: Routes = [
  {
    path: 'signin',
    title: 'Sign in · Cortex',
    loadComponent: () => import('./features/auth/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'auth/done',
    title: 'Signing in · Cortex',
    loadComponent: () => import('./features/auth/auth-done').then((m) => m.AuthDone),
  },
  {
    path: '',
    canActivate: [authGuard],
    title: 'Dashboard · Cortex',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'map',
    canActivate: [authGuard],
    title: 'Knowledge map · Cortex',
    loadComponent: () =>
      import('./features/knowledge-map/knowledge-map').then((m) => m.KnowledgeMapPage),
  },
  {
    path: 'patterns',
    canActivate: [authGuard],
    title: 'Patterns · Cortex',
    loadComponent: () => import('./features/patterns/patterns').then((m) => m.Patterns),
  },
  {
    path: 'practice',
    canActivate: [authGuard],
    title: 'Practice · Cortex',
    loadComponent: () =>
      import('./features/practice/practice-list').then((m) => m.PracticeList),
  },
  {
    path: 'practice/:id',
    canActivate: [authGuard],
    title: 'Practice · Cortex',
    loadComponent: () =>
      import('./features/practice/practice-page').then((m) => m.PracticePage),
  },
  {
    path: 'review',
    canActivate: [authGuard],
    title: 'Review · Cortex',
    loadComponent: () => import('./features/review/review').then((m) => m.Review),
  },
  {
    path: 'cheatsheet',
    canActivate: [authGuard],
    title: 'Big-O cheat sheet · Cortex',
    loadComponent: () => import('./features/cheatsheet/cheatsheet').then((m) => m.Cheatsheet),
  },
  {
    path: 'jobs',
    canActivate: [authGuard],
    title: 'Job tracker · Cortex',
    loadComponent: () => import('./features/jobs/job-board').then((m) => m.JobBoard),
  },
  {
    path: 'interview',
    canActivate: [authGuard],
    title: 'Interview prep · Cortex',
    loadComponent: () => import('./features/jobs/interview-prep').then((m) => m.InterviewPrep),
  },
  {
    path: 'resume-match',
    canActivate: [authGuard],
    title: 'Resume match · Cortex',
    loadComponent: () => import('./features/jobs/resume-match').then((m) => m.ResumeMatch),
  },
  {
    path: 'offers',
    canActivate: [authGuard],
    title: 'Offers · Cortex',
    loadComponent: () => import('./features/jobs/offers').then((m) => m.Offers),
  },
  {
    path: 'tools',
    canActivate: [authGuard],
    title: 'Developer tools · Cortex',
    loadComponent: () => import('./features/tools/tools').then((m) => m.Tools),
  },
  {
    path: 'topics/:id',
    canActivate: [authGuard],
    title: 'Topic · Cortex',
    loadComponent: () => import('./features/topics/topic-page').then((m) => m.TopicPage),
  },
  {
    path: 'visualizer',
    canActivate: [authGuard],
    title: 'Visualizer · Cortex',
    loadComponent: () => import('./features/visualizer/visualizer').then((m) => m.Visualizer),
  },
  {
    path: 'visualizer/:key',
    canActivate: [authGuard],
    title: 'Visualizer · Cortex',
    loadComponent: () => import('./features/visualizer/visualizer').then((m) => m.Visualizer),
  },
  {
    path: 'tutor',
    canActivate: [authGuard],
    title: 'Tutor · Cortex',
    loadComponent: () => import('./features/tutor/tutor').then((m) => m.Tutor),
  },
  {
    path: 'tutor/:sessionId',
    canActivate: [authGuard],
    title: 'Tutor · Cortex',
    loadComponent: () => import('./features/tutor/tutor').then((m) => m.Tutor),
  },
  {
    path: 'roadmap',
    canActivate: [authGuard],
    title: 'Roadmap · Cortex',
    loadComponent: () => import('./features/roadmap/roadmap').then((m) => m.Roadmap),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    title: 'Settings · Cortex',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: '' },
];

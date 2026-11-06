import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

// Zoneless change detection is the default in Angular 22: no zone.js, signals drive updates.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(), // route params arrive as component input()s
      // No withViewTransitions(): when the browser aborts a transition (e.g. a background
      // tab), navigation could stall and leave the page blank.
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
  ],
};

import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  NavigationError,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';

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
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withNavigationErrorHandler(reloadOnStaleChunk),
    ),
  ],
};

/**
 * After a rebuild or deploy, an open tab still asks for the old lazy-loaded page files, which no
 * longer exist, and the page would stay blank. Reload once to fetch the new build. A short
 * time guard stops a reload loop if the server is really down.
 */
function reloadOnStaleChunk(error: NavigationError): void {
  const message = String((error.error as Error)?.message ?? error.error);
  if (!/dynamically imported module|Loading chunk|Importing a module script failed/i.test(message)) {
    return;
  }
  const key = 'cortex.chunk-reload';
  try {
    // Reloaded in the last 10 seconds and it still fails: the server is down, stop here.
    if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // storage blocked: reload anyway, a down server will show the browser's own error page
  }
  location.assign(error.url);
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth } from './auth';

/**
 * Lets you in when the API needs no sign-in (dev mode) or you are signed in. When the API cannot
 * be reached it also lets you through: the app shell shows a "can't reach Cortex" screen, and
 * signing you out for a cold start would be wrong.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.mode() === null) await auth.init();
  if (auth.status() === 'offline') return true;
  return auth.mode() === 'dev' || auth.signedIn() ? true : router.createUrlTree(['/signin']);
};

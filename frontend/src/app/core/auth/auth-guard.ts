import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth } from './auth';

/** Lets you in when the API needs no sign-in (dev mode) or you are signed in. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.mode() === null) await auth.init();
  return auth.mode() === 'dev' || auth.signedIn() ? true : router.createUrlTree(['/signin']);
};

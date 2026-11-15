import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { Auth, errorCode } from './auth';

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/** Adds the bearer token to API calls; on an expired token refreshes once and retries once. */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  if (!req.url.startsWith('/api/') || req.url.startsWith('/api/v1/auth/')) return next(req);

  const auth = inject(Auth);
  const router = inject(Router);

  const leave = async () => {
    await auth.signOut();
    await router.navigate(['/signin']);
  };

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
      const code = errorCode(err);
      if (code === 'token_expired') {
        return from(auth.refresh()).pipe(
          switchMap((ok) => {
            if (ok) return next(withToken(req, auth.accessToken()));
            return from(leave()).pipe(switchMap(() => throwError(() => err)));
          }),
        );
      }
      if (auth.mode() !== 'dev') {
        return from(leave()).pipe(switchMap(() => throwError(() => err)));
      }
      return throwError(() => err);
    }),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Blocks a route until a session exists; otherwise redirects to /login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.session() ? true : router.parseUrl('/login');
};

/** Admin-only routes. Falls back to the home page for non-admins. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.session()) return router.parseUrl('/login');
  return (await auth.refreshAdmin()) ? true : router.parseUrl('/');
};

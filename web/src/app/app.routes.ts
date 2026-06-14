import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'create',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/create-event/create-event.component').then((m) => m.CreateEventComponent),
  },
  {
    path: 'events/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
  },
  { path: '**', redirectTo: '' },
];

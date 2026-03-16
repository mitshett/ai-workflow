import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'designer', pathMatch: 'full' },
      {
        path: 'designer',
        loadComponent: () =>
          import('./features/designer/designer.component').then(
            (m) => m.DesignerComponent
          ),
      },
      {
        path: 'forms',
        loadComponent: () =>
          import('./features/forms/forms.component').then(
            (m) => m.FormsComponent
          ),
      },
      {
        path: 'library',
        loadComponent: () =>
          import('./features/library/library.component').then(
            (m) => m.LibraryComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'designer' },
];

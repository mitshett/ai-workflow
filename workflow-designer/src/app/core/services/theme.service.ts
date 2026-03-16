import { inject, Injectable } from '@angular/core';
import { WorkflowStore, type Theme } from './workflow.store';

const STORAGE_KEY = 'wd-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(WorkflowStore);

  /** Call once in AppComponent constructor to restore persisted theme */
  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const theme: Theme =
      saved === 'magnetic-blue-light' || saved === 'magnetic-dark' ? saved : 'magnetic-blue-light';
    this.apply(theme);
  }

  toggle(): void {
    const next: Theme =
      this.store.theme() === 'magnetic-blue-light' ? 'magnetic-dark' : 'magnetic-blue-light';
    this.apply(next);
  }

  apply(theme: Theme): void {
    const body = document.body;
    body.classList.remove('magnetic-blue-light', 'magnetic-dark');
    body.classList.add(theme);
    this.store.setTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }
}

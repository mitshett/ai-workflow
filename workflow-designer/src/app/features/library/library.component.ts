import { Component } from '@angular/core';
import { EmptyStateComponent } from '@polarity/components/empty-state';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div class="page-center">
      <pol-empty-state
        [illustration]="'info'"
        [header]="'Workflow Library'"
        [message]="'Browse, upload, and manage saved workflows. Coming soon.'"
      />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      height: 100%;
    }
    .page-center {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
  `],
})
export class LibraryComponent {}

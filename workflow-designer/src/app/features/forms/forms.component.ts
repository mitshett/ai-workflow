import { Component } from '@angular/core';
import { EmptyStateComponent } from '@polarity/components/empty-state';

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div class="page-center">
      <pol-empty-state
        [illustration]="'info'"
        [header]="'Form Builder'"
        [message]="'Build and manage forms for your workflows. Coming soon.'"
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
export class FormsComponent {}

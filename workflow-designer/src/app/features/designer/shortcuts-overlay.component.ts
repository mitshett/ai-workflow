import {
  Component,
  HostListener,
  Injectable,
  inject,
} from '@angular/core';
import {
  ModalComponent,
  ModalTitleDirective,
  ModalBodyDirective,
  ModalFooterDirective,
  ModalCloseDirective,
  Modal,
  MODAL_REF,
} from '@polarity/components/modal';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { DividerComponent } from '@polarity/components/divider';
import { TagComponent } from '@polarity/components/tag';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Canvas',
    shortcuts: [
      { keys: ['Scroll'], label: 'Zoom in / out' },
      { keys: ['Drag'], label: 'Pan canvas' },
      { keys: ['F'], label: 'Fit screen' },
    ],
  },
  {
    title: 'Nodes',
    shortcuts: [
      { keys: ['Click'], label: 'Select node' },
      { keys: ['Drag header'], label: 'Move node' },
      { keys: ['Delete', 'Backspace'], label: 'Delete selected' },
      { keys: ['Esc'], label: 'Clear selection' },
    ],
  },
  {
    title: 'Edges',
    shortcuts: [
      { keys: ['Drag port'], label: 'Draw edge' },
      { keys: ['Click edge'], label: 'Select edge' },
      { keys: ['Delete', 'Backspace'], label: 'Delete selected edge' },
    ],
  },
  {
    title: 'Workflow',
    shortcuts: [
      { keys: ['Ctrl', 'S'], label: 'Save workflow' },
      { keys: ['Ctrl', 'Shift', 'R'], label: 'Run workflow' },
      { keys: ['?'], label: 'Toggle this help' },
    ],
  },
];

/**
 * Content component rendered inside the Polarity modal.
 */
@Component({
  selector: 'app-shortcuts-overlay',
  standalone: true,
  imports: [
    ModalComponent,
    ModalTitleDirective,
    ModalBodyDirective,
    ModalFooterDirective,
    ModalCloseDirective,
    ButtonComponent,
    IconComponent,
    DividerComponent,
    TagComponent,
  ],
  templateUrl: './shortcuts-overlay.component.html',
  styleUrl: './shortcuts-overlay.component.scss',
})
export class ShortcutsOverlayComponent {
  protected readonly groups = SHORTCUT_GROUPS;
  private readonly modalRef = inject(MODAL_REF);

  protected close(): void {
    this.modalRef.close();
  }
}

/**
 * Injectable service that opens the keyboard shortcuts modal.
 * Tracks open state so that repeated calls to toggle() don't stack modals.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsModalService {
  private readonly modal = inject(Modal);
  private isOpen = false;

  toggle(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    const ref = this.modal.open(ShortcutsOverlayComponent, {
      size: 'small',
      closeOnBackdropClick: true,
    });
    ref.afterClosed().subscribe(() => {
      this.isOpen = false;
    });
  }
}

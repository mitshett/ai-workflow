import {
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent } from '@polarity/components/button';
import { EmptyStateComponent } from '@polarity/components/empty-state';
import { IconComponent } from '@polarity/components/icon';
import { SearchComponent } from '@polarity/components/search';
import {
  NODE_TEMPLATES,
  type NodeCategory,
  type NodeTemplate,
  type NodeType,
} from '../../core/models/node.models';
import { WorkflowStore } from '../../core/services/workflow.store';

/** Emitted when the user wants to add a node to the canvas */
export interface AddNodeRequest {
  type: NodeType;
  /** Suggested drop position — centre of canvas until Phase 4 wires drag-drop */
  position: { x: number; y: number };
}

const CATEGORIES: NodeCategory[] = ['Control Flow', 'AI', 'Integration'];

@Component({
  selector: 'app-node-palette',
  standalone: true,
  imports: [
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    SearchComponent,
  ],
  templateUrl: './node-palette.component.html',
  styleUrl: './node-palette.component.scss',
})
export class NodePaletteComponent {
  protected readonly store = inject(WorkflowStore);

  /** Emitted when the user clicks a node card (adds it to canvas) */
  readonly addNode = output<AddNodeRequest>();

  protected readonly categories = CATEGORIES;

  // ── Search ────────────────────────────────────────────────────────────────

  protected readonly searchQuery = signal('');

  protected readonly filteredTemplates = computed<NodeTemplate[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return NODE_TEMPLATES;
    return NODE_TEMPLATES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  });

  protected readonly hasResults = computed(
    () => this.filteredTemplates().length > 0
  );

  protected readonly isCollapsed = computed(() => this.store.sidebarCollapsed());

  // ── Helpers ───────────────────────────────────────────────────────────────

  protected templatesForCategory(category: NodeCategory): NodeTemplate[] {
    return this.filteredTemplates().filter((t) => t.category === category);
  }

  protected categoryVisible(category: NodeCategory): boolean {
    return this.templatesForCategory(category).length > 0;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected onToggleCollapse(): void {
    this.store.toggleSidebar();
  }

  protected onAddNode(template: NodeTemplate): void {
    // Default drop position in canvas centre — Phase 4 will replace with
    // actual drag-and-drop coordinates
    this.addNode.emit({
      type: template.type,
      position: { x: 200, y: 200 },
    });
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }
}

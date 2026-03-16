import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CardComponent } from '@polarity/components/card';
import { IconComponent } from '@polarity/components/icon';
import { BadgeComponent } from '@polarity/components/badge';
import { SpinnerComponent } from '@polarity/components/spinner';
import { TagComponent } from '@polarity/components/tag';
import type { CanvasNode } from '../../../core/models/node.models';
import type { NodeResult } from '../../../core/models/execution.models';
import { CanvasComponent } from '../canvas.component';
import { NODE_TEMPLATES } from '../../../core/models/node.models';
import { WorkflowStore } from '../../../core/services/workflow.store';

// ── Badge status map ───────────────────────────────────────────────────────

type PolarityBadgeStatus =
  | 'negative'
  | 'severe-warning'
  | 'warning'
  | 'low-warning'
  | 'positive'
  | 'excellent'
  | 'in-progress'
  | 'info'
  | 'inactive'
  | 'disabled'
  | 'allow'
  | 'deny';

const NODE_TYPE_BADGE_STATUS: Record<string, PolarityBadgeStatus> = {
  start: 'positive',
  end: 'negative',
  gateway: 'warning',
  approval: 'in-progress',
  agent: 'info',
  mcp_tool: 'allow',
  rest_client: 'low-warning',
};

const NODE_STATUS_BADGE: Record<string, PolarityBadgeStatus> = {
  success: 'positive',
  failed: 'negative',
  in_progress: 'in-progress',
  skipped: 'inactive',
  timeout: 'severe-warning',
};

@Component({
  selector: 'app-node',
  standalone: true,
  imports: [CardComponent, IconComponent, BadgeComponent, SpinnerComponent, TagComponent],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
  host: {
    class: 'canvas-node',
    '[style.left.px]': 'node().position.x',
    '[style.top.px]': 'node().position.y',
    '[class.wd-node-selected]': 'isSelected()',
    '[class.wd-node-running]': 'executionResult()?.status === "in_progress"',
    // Drop-target attributes — lets tryCommitEdge detect a drop anywhere on the card
    '[attr.data-node-id]': 'node().id',
    'data-drop-target': 'true',
  },
})
export class NodeComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  readonly node = input.required<CanvasNode>();
  readonly isSelected = input<boolean>(false);
  readonly executionResult = input<NodeResult | null>(null);
  readonly isReadOnly = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  readonly selectNode = output<string>();
  readonly moveNode = output<{ id: string; position: { x: number; y: number } }>();

  // ── Injected services ─────────────────────────────────────────────────────

  private readonly canvas = inject(CanvasComponent);
  private readonly ngZone = inject(NgZone);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly store = inject(WorkflowStore);

  // ── Computed helpers ──────────────────────────────────────────────────────

  protected readonly template = computed(() =>
    NODE_TEMPLATES.find((t) => t.type === this.node().type)
  );

  protected readonly nodeColor = computed(
    () => this.template()?.color ?? 'var(--pol-color-neutral-500)'
  );

  protected readonly nodeIcon = computed(
    () => this.template()?.icon ?? 'circle'
  );

  protected readonly typeBadgeStatus = computed(
    () => NODE_TYPE_BADGE_STATUS[this.node().type] ?? 'info'
  );

  protected readonly typeLabel = computed(
    () => this.node().type.replace('_', ' ')
  );

  protected readonly isGateway = computed(() => this.node().type === 'gateway');

  /** True when this node has 2+ outgoing edges — fan-out / fork point. */
  protected readonly isFork = computed(() => {
    const id = this.node().id;
    return this.store.edges().filter((e) => e.sourceNodeId === id).length >= 2;
  });

  /** True when this node has 2+ incoming edges — fan-in / join point. */
  protected readonly isJoin = computed(() => {
    const id = this.node().id;
    return this.store.edges().filter((e) => e.targetNodeId === id).length >= 2;
  });

  // Execution result display helpers
  protected readonly showExecutionBadge = computed(() => {
    const r = this.executionResult();
    return r !== null && r.status !== 'pending';
  });

  protected readonly isRunning = computed(
    () => this.executionResult()?.status === 'in_progress'
  );

  protected readonly execBadgeStatus = computed((): PolarityBadgeStatus => {
    const status = this.executionResult()?.status;
    return NODE_STATUS_BADGE[status ?? ''] ?? 'info';
  });

  protected readonly execBadgeLabel = computed(
    () => this.executionResult()?.status?.replace('_', ' ') ?? ''
  );

  // ── Drag state ─────────────────────────────────────────────────────────────

  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // ── Header drag handle ────────────────────────────────────────────────────

  onDragHandleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (this.isReadOnly()) return;
    event.stopPropagation(); // Prevent canvas pan

    // Select this node
    this.selectNode.emit(this.node().id);

    this.isDragging = true;

    // Compute offset from node's world position to the pointer position
    const worldPos = this.canvas.toWorldCoords(event.clientX, event.clientY);
    this.dragOffsetX = worldPos.x - this.node().position.x;
    this.dragOffsetY = worldPos.y - this.node().position.y;

    this.hostEl.nativeElement.classList.add('wd-node-dragging');
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    this.ngZone.run(() => {
      const worldPos = this.canvas.toWorldCoords(event.clientX, event.clientY);
      const GRID = 16;
      const x = Math.round((worldPos.x - this.dragOffsetX) / GRID) * GRID;
      const y = Math.round((worldPos.y - this.dragOffsetY) / GRID) * GRID;
      this.moveNode.emit({ id: this.node().id, position: { x, y } });
    });
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    if (event.button !== 0) return;

    this.isDragging = false;
    this.hostEl.nativeElement.classList.remove('wd-node-dragging');
  }

  // ── Click to select (on card body, not drag handle) ───────────────────────

  onCardSelect(): void {
    if (this.isReadOnly()) return;
    this.selectNode.emit(this.node().id);
  }
}

import {
  Component,
  computed,
  HostListener,
  ViewChild,
  inject,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { WorkflowStore } from '../../core/services/workflow.store';
import { TemporalService } from '../../core/services/temporal.service';
import { WorkflowSerializerService } from '../../core/services/workflow-serializer';
import { NodePaletteService } from '../../core/services/node-palette.service';
import { CanvasComponent } from '../canvas/canvas.component';
import { PropertiesHostComponent } from '../properties/properties-host.component';
import { ExecutionPanelComponent } from '../execution/execution-panel.component';
import { ShortcutsModalService } from './shortcuts-overlay.component';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { SpinnerComponent } from '@polarity/components/spinner';
import { TagComponent } from '@polarity/components/tag';
import { NODE_TEMPLATES } from '../../core/models/node.models';
import type { CanvasNode, StartConfig } from '../../core/models/node.models';
import type { ExecutionState, NodeResult } from '../../core/models/execution.models';
import { interval, Subject, takeUntil } from 'rxjs';

// Maps Temporal backend status values to the store's ExecutionState type
const STATUS_MAP: Record<string, ExecutionState> = {
  running: 'running',
  paused_approval: 'paused_approval',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
  timeout: 'failed',
};

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [
    CanvasComponent,
    PropertiesHostComponent,
    ExecutionPanelComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
    TagComponent,
  ],
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.scss',
})
export class DesignerComponent implements OnInit, OnDestroy {
  protected readonly store = inject(WorkflowStore);
  private readonly temporalService = inject(TemporalService);
  private readonly serializer = inject(WorkflowSerializerService);
  private readonly nodePaletteService = inject(NodePaletteService);
  protected readonly shortcutsModal = inject(ShortcutsModalService);

  /** True when any right panel is visible (properties or execution). */
  protected readonly isPanelOpen = computed(() =>
    this.store.rightPanelMode() === 'execution' ||
    (this.store.rightPanelMode() === 'properties' && this.store.rightPanelOpen())
  );

  /** Zoom percentage label for the canvas overlay. */
  protected readonly zoomLabel = computed(() =>
    `${Math.round(this.store.viewport().zoom * 100)}%`
  );

  /** Whether the workflow is currently executing. */
  protected readonly isRunning = computed(
    () => this.store.executionState() === 'running'
  );

  /** Whether the Run button should be enabled. */
  protected readonly canRun = this.store.canRun;

  @ViewChild(CanvasComponent)
  private canvasRef?: CanvasComponent;

  /** Emits when polling should stop. */
  private readonly stopPolling$ = new Subject<void>();

  ngOnInit(): void {
    // Subscribe to node-add requests from the shell navigation
    this.nodePaletteService.addNode$
      .pipe(takeUntil(this.stopPolling$))
      .subscribe((type) => this.onAddNode(type));
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.stopPolling$.complete();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement).tagName;
    // Ignore keypresses inside text inputs
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // ── Modifier combos (checked before the switch) ──────────────────────────
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
      event.preventDefault();
      this.onRun();
      return;
    }
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      this.onSave();
      return;
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace': {
        const selNodeId = this.store.selectedNodeId();
        const selEdgeId = this.store.selectedEdgeId();
        if (selNodeId) {
          this.store.removeNode(selNodeId);
          event.preventDefault();
        } else if (selEdgeId) {
          this.store.removeEdge(selEdgeId);
          event.preventDefault();
        }
        break;
      }
      case 'Escape': {
        // If panel is expanded (docked or fullscreen), collapse it first
        if (this.store.rightPanelExpanded()) {
          this.store.setRightPanelExpanded(false);
        } else {
          this.store.closePanel();
          this.store.clearSelection();
        }
        break;
      }
      case 'f':
      case 'F': {
        this.canvasRef?.fitScreen();
        event.preventDefault();
        break;
      }
      case '?': {
        this.shortcutsModal.toggle();
        event.preventDefault();
        break;
      }
    }
  }

  // ── Toolbar event handlers ─────────────────────────────────────────────────

  protected onRun(): void {
    if (!this.store.canRun()) return;

    // Read the Start node's input_schema
    const startNode = this.store.nodes().find((n) => n.type === 'start');
    const schema = (startNode?.config as StartConfig)?.input_schema ?? {};
    const fields = Object.entries(schema).map(([key, def]) => ({ key, ...def }));

    // Open the execution panel in collecting mode
    this.store.openRunPanel(fields);
  }

  /** Called by the execution panel when the user submits run inputs. */
  protected onSubmitRunInputs(inputData: Record<string, unknown>): void {
    this.executeWithInputData(inputData);
  }

  private executeWithInputData(inputData: Record<string, unknown>): void {
    // Stop any previous polling cycle
    this.stopPolling$.next();

    const runId = crypto.randomUUID();
    const payload = this.serializer.serialize(
      this.store.nodes(),
      this.store.edges(),
      this.store.workflowName(),
      inputData,
    );

    this.store.startExecution(runId);

    // Zoom out to 75% so the execution panel has room to display results
    this.canvasRef?.setZoom(0.75);

    this.temporalService.execute({ ...payload, run_id: runId }).subscribe({
      next: () => {
        // Execution accepted — begin polling for status
        this.startPolling(runId);
      },
      error: (err: Error) => {
        console.error('[DesignerComponent] Execute failed:', err.message);
        this.store.setExecutionState('failed');
      },
    });
  }

  /** Called by execution panel Approve button. */
  protected onApprove(nodeId: string): void {
    const runId = this.store.activeRunId();
    if (!runId) return;
    this.temporalService.approve(runId, nodeId).subscribe({
      next: () => {
        // Clear approval state — polling will pick up the new status
        this.store.setPendingApproval(null);
      },
      error: (err: Error) => {
        console.error('[DesignerComponent] Approve failed:', err.message);
      },
    });
  }

  /** Called by execution panel Reset button. Returns to properties view. */
  protected onResetExecution(): void {
    this.stopPolling$.next();
    this.store.resetExecution();
  }

  /** Called by execution panel Close × button (terminal state only). */
  protected onCloseExecution(): void {
    this.onResetExecution();          // stops polling + resets store (restores sidebar)
    this.canvasRef?.setZoom(0.75);    // restore zoom to 75%
  }

  private startPolling(runId: string): void {
    const TERMINAL: ExecutionState[] = ['completed', 'failed'];

    interval(2000)
      .pipe(takeUntil(this.stopPolling$))
      .subscribe(() => {
        this.temporalService.getStatus(runId).subscribe({
          next: (res) => {
            const mapped = STATUS_MAP[res.status] ?? 'running';
            this.store.setExecutionState(mapped);

            // Update per-node results
            for (const nr of res.node_results ?? []) {
              // Find canvas node to get its alias
              const canvasNode = this.store.nodes().find((n) => n.id === nr.node_id);
              const nodeResult: NodeResult = {
                nodeId: nr.node_id,
                alias: canvasNode?.alias ?? nr.node_id,
                status: nr.status as NodeResult['status'],
                data: nr.data,
                error: nr.error ?? undefined,
              };
              this.store.updateNodeResult(nodeResult);
            }

            // Handle approval pause
            if (mapped === 'paused_approval') {
              // Find the first node with in_progress status as the pending approval node
              const approvalNode = res.node_results?.find(
                (nr) => nr.status === 'in_progress',
              );
              this.store.setPendingApproval(approvalNode?.node_id ?? null);
            }

            // Stop polling on terminal status
            if (TERMINAL.includes(mapped)) {
              // Resolve the End node's result template against the workflow context
              const endResult = res.end_data?.['result'];
              if (endResult !== undefined && endResult !== null) {
                const resolved = this.resolveContextTemplate(
                  String(endResult),
                  res.context as Record<string, unknown>,
                );
                this.store.setWorkflowOutput(resolved);
              }
              this.stopPolling$.next();
            }
          },
          error: (err: Error) => {
            console.error('[DesignerComponent] Status poll failed:', err.message);
            // Don't stop polling on a transient network error — keep trying
          },
        });
      });
  }

  /**
   * Resolves a simple {{ dot.path }} template against the workflow context.
   * Walks the dot-separated path on the context object and returns the live value.
   * Falls back to the raw template string if the path is not found.
   */
  private resolveContextTemplate(
    template: string,
    context: Record<string, unknown>,
  ): unknown {
    const match = template.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (!match) return template;
    const parts = match[1].split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value === null || value === undefined || typeof value !== 'object') {
        return template;
      }
      value = (value as Record<string, unknown>)[part];
    }
    return value ?? template;
  }

  protected onSave(): void {
    const workflow = {
      name: this.store.workflowName(),
      nodes: this.store.nodes(),
      edges: this.store.edges(),
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.store.workflowName().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onLoad(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        this.store.loadWorkflow(json.nodes ?? [], json.edges ?? [], json.name);
      } catch {
        console.error('[DesignerComponent] Failed to parse workflow JSON');
      }
    };
    reader.readAsText(file);
  }

  protected onClear(): void {
    this.store.clearCanvas();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      this.onLoad(file);
    }
    input.value = ''; // reset so same file can be re-uploaded
  }

  protected onFitScreen(): void {
    this.canvasRef?.fitScreen();
  }

  protected onZoomIn(): void {
    this.canvasRef?.zoomIn();
  }

  protected onZoomOut(): void {
    this.canvasRef?.zoomOut();
  }

  // ── Node palette handler ───────────────────────────────────────────────────

  private onAddNode(type: string): void {
    const template = NODE_TEMPLATES.find((t) => t.type === type);
    if (!template) return;

    // Drop at canvas viewport centre in world coords (fallback to 200,200)
    const centre = this.canvasRef?.getViewportCentreWorld() ?? { x: 200, y: 200 };

    // Offset each new node of the same type slightly so stacked nodes don't overlap
    const count = this.store.nodes().filter((n) => n.type === type).length;
    const id = `${type}_${Date.now()}`;

    const isUnique = template.type === 'start' || template.type === 'end';

    const node: CanvasNode = {
      id,
      type: template.type,
      alias: `${template.type}_${count + 1}`,
      label: isUnique ? template.label : `${template.label} ${count + 1}`,
      position: {
        x: Math.round(centre.x) + count * 24,
        y: Math.round(centre.y) + count * 24,
      },
      config: { ...template.defaultConfig },
    };

    this.store.addNode(node);
    this.store.selectNode(id);
  }
}

import { Component, computed, effect, HostListener, inject, output, signal, ViewChild, type ElementRef } from '@angular/core';
import { BadgeComponent } from '@polarity/components/badge';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { SpinnerComponent } from '@polarity/components/spinner';
import { EmptyStateComponent } from '@polarity/components/empty-state';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { InputNumberComponent } from '@polarity/components/input-number';
import { SelectComponent } from '@polarity/components/select';
import { ToggleComponent } from '@polarity/components/toggle';
import { TextAreaComponent } from '@polarity/components/textarea';
import { AiInputFieldComponent } from '@polarity/ai-components/input-field';
import { WorkflowStore } from '../../core/services/workflow.store';
import { TemporalService } from '../../core/services/temporal.service';
import { NODE_TEMPLATES } from '../../core/models/node.models';
import type { CanvasEdge, CanvasNode, RunField } from '../../core/models/node.models';
import type { SelectItem } from '@polarity/components/select';
import type { ChatMessage, WorkflowChatContext, NodeStatus } from '../../core/models/execution.models';

// ── Topological sort (Kahn's algorithm) ────────────────────────────────────────
// Returns nodes ordered by graph depth (connection order).
// Disconnected nodes are appended at the end in their original order.
function topoSort(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const edge of edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    sorted.push(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inOrder = new Set(sorted);
  const disconnected = nodes.filter((n) => !inOrder.has(n.id));
  return [...sorted.map((id) => nodeById.get(id)).filter((n): n is CanvasNode => n !== undefined), ...disconnected];
}

// ── Status helpers ─────────────────────────────────────────────────────────────

interface StatusConfig {
  icon: string;
  badgeStatus: 'info' | 'positive' | 'negative' | 'warning' | 'inactive';
  label: string;
  spinning: boolean;
}

const STATUS_CONFIG: Record<NodeStatus | 'pending', StatusConfig> = {
  pending:     { icon: 'clock',            badgeStatus: 'inactive', label: 'Pending',     spinning: false },
  in_progress: { icon: 'circle-notch',     badgeStatus: 'info',     label: 'Running',     spinning: true  },
  success:     { icon: 'check-circle',     badgeStatus: 'positive', label: 'Success',     spinning: false },
  failed:      { icon: 'x-circle',         badgeStatus: 'negative', label: 'Failed',      spinning: false },
  skipped:     { icon: 'minus-circle',     badgeStatus: 'inactive', label: 'Skipped',     spinning: false },
  timeout:     { icon: 'warning-circle',   badgeStatus: 'warning',  label: 'Timeout',     spinning: false },
};

/** One row displayed in the panel for a canvas node. */
export interface NodeRow {
  id: string;
  alias: string;
  label: string;
  icon: string;
  typeColor: string;
  status: NodeStatus | 'pending';
  statusConfig: StatusConfig;
  error?: string;
  isPendingApproval: boolean;
  // Output data
  outputVars: { key: string; value: string }[];
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
}

@Component({
  selector: 'app-execution-panel',
  standalone: true,
  imports: [
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
    ToggleComponent,
    TextAreaComponent,
    AiInputFieldComponent,
  ],
  templateUrl: './execution-panel.component.html',
  styleUrl: './execution-panel.component.scss',
})
export class ExecutionPanelComponent {
  protected readonly store = inject(WorkflowStore);

  /** Emitted when the user clicks Approve on a paused node. */
  readonly approve = output<string>();  // nodeId

  /** Emitted when the user submits run inputs. */
  readonly submitInputs = output<Record<string, unknown>>();

  /** Emitted when the user clicks the Reset button. */
  readonly reset = output<void>();

  /** Emitted when the user clicks the close button (terminal state only). */
  readonly close = output<void>();

  /** Tracks which node rows are expanded to show output. */
  protected readonly expandedIds = signal<Set<string>>(new Set());

  // ── Expand dropdown ────────────────────────────────────────────────────────
  protected readonly expandMenuOpen = signal(false);

  @ViewChild('expandDropdown') private expandDropdownRef?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.expandMenuOpen()) return;
    const el = this.expandDropdownRef?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.expandMenuOpen.set(false);
    }
  }

  protected onSelectExpandMode(mode: 'docked' | 'fullscreen'): void {
    const current = this.store.rightPanelExpanded();
    if (current === mode) {
      this.store.setRightPanelExpanded(mode === 'fullscreen' ? 'docked' : false);
    } else {
      this.store.setRightPanelExpanded(mode);
    }
    this.expandMenuOpen.set(false);
  }

  // ── Chat Q&A ────────────────────────────────────────────────────────────────

  private readonly temporalService = inject(TemporalService);

  protected readonly chatHistory = signal<ChatMessage[]>([]);
  protected readonly isChatLoading = signal(false);
  protected readonly chatError = signal<string | null>(null);

  // ── Chat / collecting state ─────────────────────────────────────────────────

  /** Live form values keyed by field key. */
  private readonly values = signal<Record<string, unknown>>({});
  protected readonly validationError = signal<string | null>(null);
  protected readonly submittedValues = signal<Record<string, unknown> | null>(null);

  protected readonly isCollecting = computed(() =>
    this.store.executionState() === 'collecting'
  );

  protected readonly runFields = this.store.runInputFields;

  /** Formatted submitted values for the "You" bubble. */
  protected readonly submittedValueEntries = computed<{ label: string; value: string }[]>(() => {
    const vals = this.submittedValues();
    const fields = this.runFields();
    if (!vals || fields.length === 0) return [];
    return fields.map((f) => ({
      label: f.label || f.key,
      value: this.displayValue(vals[f.key]),
    }));
  });

  /** Initialize form defaults when collecting starts. */
  private readonly initFormEffect = effect(() => {
    if (this.isCollecting()) {
      const fields = this.runFields();
      const initial: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.default !== undefined && field.default !== null) {
          initial[field.key] = field.default;
        } else if (field.type === 'boolean') {
          initial[field.key] = false;
        } else if (field.type === 'number') {
          initial[field.key] = 0;
        } else {
          initial[field.key] = '';
        }
      }
      this.values.set(initial);
      this.validationError.set(null);
      this.submittedValues.set(null);
    }
  }, { allowSignalWrites: true });

  // ── Computed ────────────────────────────────────────────────────────────────

  protected readonly executionState = this.store.executionState;
  protected readonly activeRunId = this.store.activeRunId;
  protected readonly pendingApprovalNodeId = this.store.pendingApprovalNodeId;

  protected readonly overallStatusConfig = computed<StatusConfig>(() => {
    switch (this.store.executionState()) {
      case 'running':          return { icon: 'circle-notch',   badgeStatus: 'info',     label: 'Running',           spinning: true  };
      case 'paused_approval':  return { icon: 'user-check',     badgeStatus: 'warning',  label: 'Awaiting Approval', spinning: false };
      case 'completed':        return { icon: 'check-circle',   badgeStatus: 'positive', label: 'Completed',         spinning: false };
      case 'failed':           return { icon: 'x-circle',       badgeStatus: 'negative', label: 'Failed',            spinning: false };
      default:                 return { icon: 'clock',          badgeStatus: 'inactive', label: 'Idle',              spinning: false };
    }
  });

  /** All canvas nodes enriched with live execution status, in connection order. */
  protected readonly nodeRows = computed<NodeRow[]>(() => {
    const sorted = topoSort(this.store.nodes(), this.store.edges());
    const resultMap = this.store.nodeResultMap();
    const pendingApprovalId = this.store.pendingApprovalNodeId();

    let endSeen = false;

    return sorted
      .filter((node) => {
        // Keep only the first end node encountered in topo order
        if (node.type === 'end') {
          if (endSeen) return false;
          endSeen = true;
        }
        return true;
      })
      .map((node) => {
        const result = resultMap.get(node.id);
        const status: NodeStatus | 'pending' = (result?.status as NodeStatus) ?? 'pending';
        const template = NODE_TEMPLATES.find((t) => t.type === node.type);

        // Flatten output data into key/value pairs for display
        const outputVars: { key: string; value: string }[] = [];
        if (result?.data && typeof result.data === 'object') {
          for (const [key, val] of Object.entries(result.data as Record<string, unknown>)) {
            outputVars.push({ key, value: this.formatValue(val) });
          }
        }

        return {
          id: node.id,
          alias: node.alias,
          label: node.label,
          icon: template?.icon ?? 'circle',
          typeColor: template?.color ?? 'var(--base-text-weak-default)',
          status,
          statusConfig: STATUS_CONFIG[status] ?? STATUS_CONFIG.pending,
          error: result?.error,
          isPendingApproval: node.id === pendingApprovalId,
          outputVars,
          durationMs: result?.durationMs,
          startedAt: result?.startedAt,
          completedAt: result?.completedAt,
        };
      });
  });

  protected readonly completedCount = computed(
    () => this.nodeRows().filter((r) => r.status === 'success').length,
  );

  protected readonly failedCount = computed(
    () => this.nodeRows().filter((r) => r.status === 'failed' || r.status === 'timeout').length
  );

  protected readonly isTerminal = computed(() => {
    const s = this.store.executionState();
    return s === 'completed' || s === 'failed';
  });

  /** Resolved End node result — null when none configured or execution not complete. */
  protected readonly workflowOutput = computed<unknown | null>(() => {
    const out = this.store.executionResult()?.workflowOutput;
    return (out !== undefined && out !== null && out !== '') ? out : null;
  });

  /** Pretty-printed string of the workflow output for display / clipboard. */
  protected readonly formattedOutput = computed<string>(() => {
    const out = this.workflowOutput();
    if (out === null) return '';
    if (typeof out === 'string') return out;
    try { return JSON.stringify(out, null, 2); } catch { return String(out); }
  });

  /** Markdown to HTML rendered output for display. */
  protected readonly renderedOutput = computed<string>(() => {
    const raw = this.formattedOutput();
    if (!raw) return '';
    return this.markdownToHtml(raw);
  });

  // ── Form value accessors ────────────────────────────────────────────────────

  protected getStringValue(key: string): string {
    const v = this.values()[key];
    return v == null ? '' : String(v);
  }

  protected getNumberValue(key: string): number {
    const v = this.values()[key];
    return typeof v === 'number' ? v : 0;
  }

  protected getBooleanValue(key: string): boolean {
    return !!this.values()[key];
  }

  protected getDropdownOptions(field: RunField): SelectItem[] {
    return (field.options ?? []).map((opt) => ({ value: opt, label: opt }));
  }

  protected setValue(key: string, value: unknown): void {
    this.values.update((v) => ({ ...v, [key]: value }));
    this.validationError.set(null);
  }

  protected onTextareaInput(key: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.setValue(key, target.value);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  protected onSubmit(): void {
    const fields = this.runFields();
    const vals = this.values();

    // Validate required fields
    const missing: string[] = [];
    for (const field of fields) {
      if (!field.required) continue;
      const val = vals[field.key];
      if (val === undefined || val === null || val === '') {
        missing.push(field.label || field.key);
      }
    }

    if (missing.length > 0) {
      this.validationError.set(`Required fields: ${missing.join(', ')}`);
      return;
    }

    this.submittedValues.set({ ...vals });
    this.submitInputs.emit(vals);
  }

  protected onApprove(nodeId: string): void {
    this.approve.emit(nodeId);
  }

  protected onReset(): void {
    this.expandedIds.set(new Set());
    this.submittedValues.set(null);
    this.chatHistory.set([]);
    this.chatError.set(null);
    this.store.setRightPanelExpanded('docked');
    this.reset.emit();
  }

  protected onClose(): void {
    this.expandedIds.set(new Set());
    this.submittedValues.set(null);
    this.chatHistory.set([]);
    this.chatError.set(null);
    this.store.setRightPanelExpanded('docked');
    this.close.emit();
  }

  protected copyOutput(): void {
    const text = this.formattedOutput();
    if (text) {
      navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
    }
  }

  // ── Chat Q&A handlers ───────────────────────────────────────────────────────

  protected sendChatMessage(text: string): void {
    const userMsg: ChatMessage = { role: 'user', content: text };
    this.chatHistory.update((h) => [...h, userMsg]);
    this.isChatLoading.set(true);
    this.chatError.set(null);

    this.temporalService
      .chat(this.chatHistory(), this.buildChatContext())
      .subscribe({
        next: (res) => {
          this.chatHistory.update((h) => [
            ...h,
            { role: 'assistant', content: res.reply },
          ]);
          this.isChatLoading.set(false);
        },
        error: () => {
          this.chatError.set('Failed to get a response. Please try again.');
          this.isChatLoading.set(false);
        },
      });
  }

  private buildChatContext(): WorkflowChatContext {
    const result = this.store.executionResult();
    const nodes = this.store.nodes();
    return {
      workflow_name: this.store.workflowName(),
      run_id: this.store.activeRunId() ?? '',
      node_results: (result?.nodeResults ?? []).map((r) => {
        const node = nodes.find((n) => n.id === r.nodeId);
        return {
          alias: r.alias,
          type: node?.type ?? 'unknown',
          status: r.status,
          data: r.data,
          error: r.error,
          duration_ms: r.durationMs,
        };
      }),
      workflow_output: result?.workflowOutput,
    };
  }

  protected toggleExpand(nodeId: string): void {
    const current = new Set(this.expandedIds());
    if (current.has(nodeId)) {
      current.delete(nodeId);
    } else {
      current.add(nodeId);
    }
    this.expandedIds.set(current);
  }

  protected isExpanded(nodeId: string): boolean {
    return this.expandedIds().has(nodeId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private displayValue(val: unknown): string {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  private formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  }

  /** Lightweight markdown to HTML converter. Handles headings, bold, lists, paragraphs. */
  private markdownToHtml(md: string): string {
    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const inlineFormat = (line: string): string => {
      // Bold: **text**
      let result = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Inline code: `text`
      result = result.replace(/`(.+?)`/g, '<code>$1</code>');
      return result;
    };

    const lines = md.split('\n');
    const html: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Empty line — close list if open, skip
      if (!trimmed) {
        if (inList) { html.push('</ul>'); inList = false; }
        continue;
      }

      // Headings: #### before ###
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (inList) { html.push('</ul>'); inList = false; }
        const level = Math.min(headingMatch[1].length, 6);
        html.push(`<h${level}>${inlineFormat(escHtml(headingMatch[2]))}</h${level}>`);
        continue;
      }

      // List items: - text
      if (trimmed.startsWith('- ')) {
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push(`<li>${inlineFormat(escHtml(trimmed.slice(2)))}</li>`);
        continue;
      }

      // Regular paragraph line
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${inlineFormat(escHtml(trimmed))}</p>`);
    }

    if (inList) html.push('</ul>');
    return html.join('\n');
  }
}

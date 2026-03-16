import { Component, HostListener, ViewChild, inject, signal, computed, effect, type ElementRef } from '@angular/core';
import { TabsComponent } from '@polarity/components/tab';
import type { Tab } from '@polarity/components/tab';
import { IconComponent } from '@polarity/components/icon';
import { WorkflowStore } from '../../core/services/workflow.store';
import { NODE_TEMPLATES } from '../../core/models/node.models';
import { NodeInfoComponent } from './panels/node-info.component';
import { StartPropsComponent } from './panels/start-props.component';
import { StartFieldsComponent } from './panels/start-fields.component';
import { EndPropsComponent } from './panels/end-props.component';
import { AgentPropsComponent } from './panels/agent-props.component';
import { McpPropsComponent } from './panels/mcp-props.component';
import { GatewayPropsComponent } from './panels/gateway-props.component';
import { ApprovalPropsComponent } from './panels/approval-props.component';
import { RestClientPropsComponent } from './panels/rest-client-props.component';
import { EdgePropsComponent } from './panels/edge-props.component';

const NODE_TABS: Tab[] = [
  { label: 'Node Info' },
  { label: 'Config' },
];

const START_NODE_TABS: Tab[] = [
  { label: 'Node Info' },
  { label: 'Config' },
  { label: 'Input Fields' },
];

const EDGE_TABS: Tab[] = [
  { label: 'Edge' },
];

@Component({
  selector: 'app-properties-host',
  standalone: true,
  imports: [
    TabsComponent,
    IconComponent,
    NodeInfoComponent,
    StartPropsComponent,
    StartFieldsComponent,
    EndPropsComponent,
    AgentPropsComponent,
    McpPropsComponent,
    GatewayPropsComponent,
    ApprovalPropsComponent,
    RestClientPropsComponent,
    EdgePropsComponent,
  ],
  templateUrl: './properties-host.component.html',
  styleUrl: './properties-host.component.scss',
})
export class PropertiesHostComponent {
  protected readonly store = inject(WorkflowStore);

  protected readonly edgeTabs: Tab[] = EDGE_TABS;

  protected readonly selectedTab = signal(0);

  protected readonly expandMenuOpen = signal(false);

  @ViewChild('expandDropdown') private expandDropdownRef?: ElementRef<HTMLElement>;

  /** Close the expand dropdown when clicking outside of it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.expandMenuOpen()) return;
    const el = this.expandDropdownRef?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.expandMenuOpen.set(false);
    }
  }

  /** Reset tab index to 0 and collapse expanded panel whenever a different node is selected. */
  private readonly lastNodeId = signal<string | null>(null);
  private readonly resetTabEffect = effect(() => {
    const id = this.store.selectedNode()?.id ?? null;
    if (id !== this.lastNodeId()) {
      this.lastNodeId.set(id);
      this.selectedTab.set(0);
      this.store.setRightPanelExpanded('docked');
    }
  }, { allowSignalWrites: true });

  /** Start nodes get a 3rd "Input Fields" tab. */
  protected readonly nodeTabs = computed<Tab[]>(() => {
    const node = this.store.selectedNode();
    return node?.type === 'start' ? START_NODE_TABS : NODE_TABS;
  });

  // ── Computed helpers ───────────────────────────────────────────────────────

  protected readonly nodeTemplate = computed(() => {
    const node = this.store.selectedNode();
    if (!node) return null;
    return NODE_TEMPLATES.find((t) => t.type === node.type) ?? null;
  });

  protected readonly nodeTypeLabel = computed(() => {
    const t = this.nodeTemplate();
    return t?.label ?? '';
  });

  protected readonly nodeColor = computed(() => {
    const t = this.nodeTemplate();
    return t?.color ?? 'var(--base-bg-strong-default)';
  });

  protected readonly nodeIcon = computed(() => {
    const t = this.nodeTemplate();
    return t?.icon ?? 'circle';
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  protected onTabChange(index: number): void {
    this.selectedTab.set(index);
  }

  protected onSelectExpandMode(mode: 'docked' | 'fullscreen'): void {
    const current = this.store.rightPanelExpanded();
    if (current === mode) {
      // Toggle off: fullscreen goes back to docked, docked goes to narrow
      this.store.setRightPanelExpanded(mode === 'fullscreen' ? 'docked' : false);
    } else {
      this.store.setRightPanelExpanded(mode);
    }
    this.expandMenuOpen.set(false);
  }

  protected closePanel(): void {
    this.store.closePanel();
  }
}

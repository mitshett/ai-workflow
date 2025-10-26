import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityTimelineComponent as PolarityActivityTimelineComponent } from '@polarity/components/activity-timeline';
import type { TimelineItem, TimelineItemStatus } from '@polarity/components/activity-timeline';
import { IconComponent } from '@polarity/components/icon';
import { BadgeComponent } from '@polarity/components/badge';
import { WorkflowExecutionResponse, NodeResult } from '../../models/workflow.models';

export interface ActivityTimelineItem extends TimelineItem {
  id: string;
  timestamp?: string;
  duration?: string;
  icon?: string;
  metadata?: {
    node_type: string;
    response: string | null;
    structured_output: Record<string, any>;
    error: string | null;
    raw_result: NodeResult;
    hasStructuredOutput: boolean;
    structuredOutputEntries: { key: string; value: string }[];
  };
}

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [
    CommonModule,
    PolarityActivityTimelineComponent,
    IconComponent,
    BadgeComponent
  ],
  template: `
    <div class="workflow-activity-timeline">
      <div class="timeline-header" *ngIf="executionResponse">
        <h3>Workflow Execution Timeline</h3>
        <div class="execution-summary">
          <pol-badge 
            [variant]="getStatusBadgeVariant(executionResponse.status)">
            {{executionResponse.status.toUpperCase()}}
          </pol-badge>
          <span class="duration" *ngIf="executionResponse.duration_seconds">
            Total: {{formatDuration(executionResponse.duration_seconds * 1000)}}
          </span>
        </div>
      </div>

      <pol-activity-timeline
        [items]="timelineItems">
        
        <!-- Custom item template -->
        <ng-template #itemTemplate let-item="item">
          <div class="timeline-item-content">
            <div class="item-header">
              <div class="item-title-row">
                <pol-icon 
                  [iconName]="item.icon || getDefaultIcon(item.metadata?.node_type)" 
                  size="small"
                  [class]="'status-' + item.status">
                </pol-icon>
                <h4 class="item-title">{{item.title}}</h4>
                <pol-badge 
                  [variant]="getStatusBadgeVariant(item.status)">
                  {{item.status}}
                </pol-badge>
              </div>
              <div class="item-metadata" *ngIf="item.duration || item.timestamp">
                <span class="duration" *ngIf="item.duration">{{item.duration}}</span>
                <span class="timestamp" *ngIf="item.timestamp">{{formatTimestamp(item.timestamp)}}</span>
              </div>
            </div>
            
            <div class="item-description" *ngIf="item.description">
              {{item.description}}
            </div>

            <!-- Node response -->
            <div class="node-response" *ngIf="item.metadata?.response && showOutputs">
              <div class="response-header">
                <span>Response:</span>
                <button 
                  class="toggle-response" 
                  (click)="toggleOutputVisibility(item.id)"
                  [class.expanded]="isOutputExpanded(item.id)">
                  <pol-icon iconName="" size="small"></pol-icon>
                </button>
              </div>
              <div class="response-content" *ngIf="isOutputExpanded(item.id)">
                <p>{{item.metadata.response}}</p>
              </div>
            </div>

            <!-- Structured output -->
            <div class="structured-output" *ngIf="item.metadata?.hasStructuredOutput && showOutputs">
              <div class="output-header">
                <span>Structured Output:</span>
                <button 
                  class="toggle-structured" 
                  (click)="toggleStructuredOutputVisibility(item.id)"
                  [class.expanded]="isStructuredOutputExpanded(item.id)">
                  <pol-icon iconName="" size="small"></pol-icon>
                </button>
              </div>
              <div class="structured-content" *ngIf="isStructuredOutputExpanded(item.id)">
                <div class="structured-data">
                  <div *ngFor="let entry of item.metadata.structuredOutputEntries" class="data-entry">
                    <strong>{{entry.key}}:</strong> {{entry.value}}
                  </div>
                </div>
              </div>
            </div>

            <!-- Error details -->
            <div class="error-details" *ngIf="item.metadata?.error">
              <pol-icon iconName="" size="small" class="error-icon"></pol-icon>
              <span class="error-message">{{item.metadata.error}}</span>
            </div>
          </div>
        </ng-template>
      </pol-activity-timeline>

      <!-- Empty state -->
      <div class="empty-timeline" *ngIf="timelineItems.length === 0">
        <pol-icon iconName="" size="large" class="empty-icon"></pol-icon>
        <p>No workflow execution data available</p>
      </div>
    </div>
  `,
  styleUrl: './activity-timeline.component.scss'
})
export class ActivityTimelineComponent implements OnChanges {
  
  @Input() executionResponse?: WorkflowExecutionResponse;
  @Input() showOutputs = true;
  @Input() maxItems = 50;

  timelineItems: ActivityTimelineItem[] = [];
  expandedOutputs = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['executionResponse'] && this.executionResponse) {
      this.buildTimelineItems();
    }
  }

  // ===============================
  // TIMELINE BUILDING METHODS
  // ===============================

  private buildTimelineItems(): void {
    if (!this.executionResponse?.nodes) {
      this.timelineItems = [];
      return;
    }

    const items: ActivityTimelineItem[] = [];

    // Sort nodes by execution order (if available) or by node type priority
    const sortedNodes = this.sortNodesByExecutionOrder();

    sortedNodes.forEach((nodeResult) => {
      const item = this.createTimelineItem(nodeResult);
      items.push(item);
    });

    // Limit items if needed
    this.timelineItems = items.slice(0, this.maxItems);
  }

  private sortNodesByExecutionOrder(): NodeResult[] {
    const nodes = [...this.executionResponse!.nodes];
    
    // Sort by node type priority since we don't have start times in the new schema
    // (start -> agent/mcp -> unknown -> end)
    return nodes.sort((aResult, bResult) => {
      const typePriority = { 'start': 0, 'agent': 1, 'mcp_tool': 1, 'condition': 1, 'unknown': 1, 'end': 2 };
      const aPriority = typePriority[aResult.node_type as keyof typeof typePriority] ?? 1;
      const bPriority = typePriority[bResult.node_type as keyof typeof typePriority] ?? 1;
      
      return aPriority - bPriority;
    });
  }

  private createTimelineItem(nodeResult: NodeResult): ActivityTimelineItem {
    // Determine status - map to Polarity TimelineItemStatus
    let status: TimelineItemStatus = 'complete';
    if (nodeResult.error) {
      status = 'error';
    } else if (nodeResult.status === 'running') {
      status = 'progress';
    } else if (nodeResult.status === 'failed') {
      status = 'error';
    } else if (nodeResult.status === 'success') {
      status = 'complete';
    }

    // Build description that includes response and structured output
    const description = this.buildNodeDescription(nodeResult);

    // Pre-calculate structured output data to avoid function calls in template
    const hasStructuredOutput = nodeResult.structured_output && Object.keys(nodeResult.structured_output).length > 0;
    const structuredOutputEntries = hasStructuredOutput 
      ? Object.entries(nodeResult.structured_output).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
        }))
      : [];

    return {
      id: nodeResult.node_id,
      title: nodeResult.node_name || nodeResult.node_id,
      description,
      status,
      timestamp: undefined, // No timestamp in new schema
      duration: undefined, // No duration in new schema
      icon: this.getNodeIcon(nodeResult.node_type),
      expanded: false,
      metadata: {
        node_type: nodeResult.node_type,
        response: nodeResult.response,
        structured_output: nodeResult.structured_output,
        error: nodeResult.error,
        raw_result: nodeResult,
        hasStructuredOutput,
        structuredOutputEntries
      }
    };
  }

  private buildNodeDescription(nodeResult: NodeResult): string {
    const parts: string[] = [];
    
    // Add node response if available
    if (nodeResult.response) {
      parts.push(nodeResult.response);
    } else {
      // Fallback to node type description
      switch (nodeResult.node_type) {
        case 'start':
          parts.push('Workflow initialization');
          break;
        case 'agent':
          parts.push('AI agent processing');
          break;
        case 'mcp_tool':
          parts.push('MCP tool execution');
          break;
        case 'condition':
          parts.push('Condition evaluation');
          break;
        case 'unknown':
          parts.push('Node execution');
          break;
        case 'end':
          parts.push('Workflow completion');
          break;
        default:
          parts.push(`${nodeResult.node_type} node execution`);
      }
    }

    // Add structured output if available and not empty
    if (nodeResult.structured_output && Object.keys(nodeResult.structured_output).length > 0) {
      const structuredOutputStr = this.formatStructuredOutput(nodeResult.structured_output);
      if (structuredOutputStr) {
        parts.push(`\n\nStructured Output:\n${structuredOutputStr}`);
      }
    }

    return parts.join(' ');
  }

  private formatStructuredOutput(structuredOutput: Record<string, any>): string {
    try {
      // Format as readable key-value pairs
      const entries = Object.entries(structuredOutput);
      if (entries.length === 0) return '';
      
      return entries
        .map(([key, value]) => {
          if (typeof value === 'object') {
            return `• ${key}: ${JSON.stringify(value)}`;
          }
          return `• ${key}: ${value}`;
        })
        .join('\n');
    } catch (error) {
      return JSON.stringify(structuredOutput, null, 2);
    }
  }

  // ===============================
  // UI HELPER METHODS
  // ===============================

  getStatusBadgeVariant(status: string): "status" {
    // Polarity badge variants are "dot" | "counter" | "notifier" | "status"
    // Using "status" for all cases as it's the most appropriate
    return "status";
  }

  getDefaultIcon(nodeType: string): string {
    switch (nodeType) {
      case 'start':
        return '';
      case 'agent':
        return '';
      case 'mcp_tool':
        return '';
      case 'condition':
        return '';
      case 'unknown':
        return '';
      case 'end':
        return '';
      default:
        return '';
    }
  }

  getNodeIcon(nodeType: string): string {
    return this.getDefaultIcon(nodeType);
  }

  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    }
    const seconds = milliseconds / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return timestamp;
    }
  }

  formatOutput(output: any): string {
    if (!output) return '';
    
    if (typeof output === 'string') {
      return output;
    }
    
    return JSON.stringify(output, null, 2);
  }

  // ===============================
  // OUTPUT EXPANSION METHODS
  // ===============================

  expandedStructuredOutputs = new Set<string>();

  toggleOutputVisibility(itemId: string): void {
    if (this.expandedOutputs.has(itemId)) {
      this.expandedOutputs.delete(itemId);
    } else {
      this.expandedOutputs.add(itemId);
    }
  }

  isOutputExpanded(itemId: string): boolean {
    return this.expandedOutputs.has(itemId);
  }

  toggleStructuredOutputVisibility(itemId: string): void {
    if (this.expandedStructuredOutputs.has(itemId)) {
      this.expandedStructuredOutputs.delete(itemId);
    } else {
      this.expandedStructuredOutputs.add(itemId);
    }
  }

  isStructuredOutputExpanded(itemId: string): boolean {
    return this.expandedStructuredOutputs.has(itemId);
  }

  // Methods removed - data is now pre-calculated in createTimelineItem() to avoid infinite change detection
}
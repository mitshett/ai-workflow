import { Component, Input, Output, EventEmitter, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Polarity Components
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';

// Models
import { WorkflowNode, JsonSchema } from '../../models/workflow.models';

// Sub-components
import { AgentPropertiesComponent } from './agent/agent-properties.component';
import { MCPPropertiesComponent } from './mcp/mcp-properties.component';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    InputTextComponent,
    AgentPropertiesComponent,
    MCPPropertiesComponent,
  ],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss'
})
export class PropertiesPanelComponent implements OnInit, OnChanges {
  
  // Inputs from parent component - maintain exact same interface
  @Input() selectedNodeId: string | null = null;
  @Input() canvasNodes: WorkflowNode[] = [];
  @Input() showJsonSchemaModal: boolean = false;
  @Input() currentJsonSchema: JsonSchema = { name: '', properties: [] };
  @Input() schemaMode: string = 'simple';
  @Input() newEnumValue: string = '';
  
  // Output events to parent component - maintain exact same interface
  @Output() closePanel = new EventEmitter<void>();
  @Output() nodeUpdate = new EventEmitter<WorkflowNode>();
  @Output() openJsonSchemaModal = new EventEmitter<void>();

  // ViewChild to access agent properties component
  @ViewChild('agentProperties') agentPropertiesComponent?: AgentPropertiesComponent;
  
  private previousShowJsonSchemaModal: boolean = false;

  // Get the currently selected node
  getSelectedNode(): WorkflowNode | null {
    if (!this.selectedNodeId) return null;
    return this.canvasNodes.find(node => node.id === this.selectedNodeId) || null;
  }

  // Get selected node type for routing
  getSelectedNodeType(): string | null {
    const node = this.getSelectedNode();
    return node?.type || null;
  }

  // Handle events from sub-components
  onClosePanel(): void {
    this.closePanel.emit();
  }

  onNodeUpdate(node: WorkflowNode): void {
    this.nodeUpdate.emit(node);
  }

  onOpenJsonSchemaModal(): void {
    this.openJsonSchemaModal.emit();
  }

  // Ensure end node has proper data structure
  private ensureEndNodeData(): void {
    const node = this.getSelectedNode();
    if (!node || node.type !== 'end') return;
    
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.endConfig) {
      node.data.endConfig = {
        nodeName: ''
      };
    }
  }

  // Call this when end node is selected
  ngOnInit(): void {
    if (this.getSelectedNodeType() === 'end') {
      this.ensureEndNodeData();
    }
    this.previousShowJsonSchemaModal = this.showJsonSchemaModal;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Detect when JSON schema modal closes
    if (changes['showJsonSchemaModal']) {
      const wasOpen = this.previousShowJsonSchemaModal;
      const isOpen = this.showJsonSchemaModal;
      
      // If modal was open and now closed, refresh agent properties cache
      if (wasOpen && !isOpen) {
        console.log('🎛️ JSON Schema modal closed - refreshing agent properties cache');
        setTimeout(() => {
          if (this.agentPropertiesComponent && this.getSelectedNodeType() === 'agent') {
            this.agentPropertiesComponent.onJsonSchemaUpdated();
          }
        }, 0); // Use timeout to ensure component is available
      }
      
      this.previousShowJsonSchemaModal = this.showJsonSchemaModal;
    }
  }

  // Handle end node name updates
  updateEndNodeName(newName: string): void {
    const node = this.getSelectedNode();
    if (!node || node.type !== 'end') return;
    
    this.ensureEndNodeData();
    if (node.data?.endConfig) {
      node.data.endConfig.nodeName = newName;
      this.nodeUpdate.emit(node);
    }
  }
}

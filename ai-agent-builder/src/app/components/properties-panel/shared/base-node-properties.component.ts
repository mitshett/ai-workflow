import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { WorkflowNode } from '../../../models/workflow.models';

/**
 * Base class for node property components
 * Contains shared functionality like caching, validation, and common operations
 */
@Component({
  template: '' // This is an abstract base class
})
export abstract class BaseNodePropertiesComponent implements OnChanges {
  
  // Inputs from parent component
  @Input() selectedNodeId: string | null = null;
  @Input() canvasNodes: WorkflowNode[] = [];
  
  // Output events to parent component
  @Output() closePanel = new EventEmitter<void>();
  @Output() nodeUpdate = new EventEmitter<WorkflowNode>();
  
  // Cached values to prevent infinite loops
  cachedSelectedNode: WorkflowNode | null = null;
  cachedWorkflowInputs: { path: string; type: string; description?: string }[] = [];
  cachedRuntimeVariables: { path: string; type: string; description?: string }[] = [];
  cachedNodeOutputs: Map<string, { path: string; type: string; description?: string }[]> = new Map();

  ngOnChanges(changes: SimpleChanges): void {
    // Update cached selected node when selectedNodeId or canvasNodes change
    if (changes['selectedNodeId'] || changes['canvasNodes']) {
      this.updateCachedSelectedNode();
    }
    
    // Update cached variables when canvasNodes change or when selected node changes
    if (changes['canvasNodes'] || changes['selectedNodeId']) {
      this.updateCachedVariables();
    }
  }

  // Force refresh of cached variables (for when JSON schema is updated)
  refreshVariableCache(): void {
    console.log('🔄 Refreshing variable cache...');
    this.updateCachedVariables();
    console.log('✅ Variable cache refreshed');
  }

  // Expose cached variables for debugging
  getCachedNodeOutputs(): Map<string, { path: string; type: string; description?: string }[]> {
    return this.cachedNodeOutputs;
  }

  protected updateCachedSelectedNode(): void {
    if (!this.selectedNodeId) {
      this.cachedSelectedNode = null;
      return;
    }
    
    const node = this.canvasNodes.find(node => node.id === this.selectedNodeId) || null;
    
    // Initialize node data if needed
    if (node) {
      this.initializeNodeData(node);
    }
    
    this.cachedSelectedNode = node;
  }

  protected updateCachedVariables(): void {
    // Cache workflow inputs
    this.cachedWorkflowInputs = [
      { path: 'workflow.input.user_request', type: 'string' },
      { path: 'workflow.run_id', type: 'string' },
      { path: 'workflow.timestamp', type: 'string' }
    ];

    // Cache runtime variables
    this.cachedRuntimeVariables = [
      { path: 'context.current_time', type: 'string' },
      { path: 'context.session_id', type: 'string' }
    ];

    // Cache node outputs
    this.cachedNodeOutputs.clear();
    this.canvasNodes.forEach(node => {
      const outputs = this.calculateNodeOutputs(node);
      this.cachedNodeOutputs.set(node.id, outputs);
    });
  }

  protected calculateNodeOutputs(node: WorkflowNode): { path: string; type: string }[] {
    const outputs: { path: string; type: string }[] = [];
    
    if (node.alias) {
      switch (node.type) {
        case 'agent':
          outputs.push(
            { path: `workflow.${node.alias}.response`, type: 'string' },
            { path: `workflow.${node.alias}.full`, type: 'object' }
          );
          
          // Add JSON schema properties if configured for structured output
          if (node.data?.agentConfig?.outputFormat === 'json' && node.data?.agentConfig?.jsonSchema?.properties) {
            node.data.agentConfig.jsonSchema.properties.forEach(property => {
              outputs.push({
                path: `workflow.${node.alias}.${property.name}`,
                type: property.type
              });
            });
          }
          break;
        case 'mcp':
          outputs.push(
            { path: `workflow.${node.alias}`, type: 'any' },
            { path: `workflow.${node.alias}.success`, type: 'boolean' },
            { path: `workflow.${node.alias}.data`, type: 'any' }
          );
          break;
        case 'start':
          outputs.push(
            { path: `workflow.${node.alias}.timestamp`, type: 'string' }
          );
          break;
        case 'end':
          outputs.push(
            { path: `workflow.${node.alias}.final_result`, type: 'any' }
          );
          break;
      }
    }
    
    return outputs;
  }

  // Get the currently selected node (returns cached value)
  getSelectedNode(): WorkflowNode | null {
    return this.cachedSelectedNode;
  }

  // Close the properties panel
  onClosePanel(): void {
    console.log('🔴 CLOSE BUTTON CLICKED!!! Properties panel close button clicked - emitting closePanel event');
    console.log('🔴 About to emit closePanel event');
    this.closePanel.emit();
    console.log('🔴 closePanel event emitted');
  }

  // Get icon name with proper typing
  getIconName(iconName: string): any {
    return iconName as any;
  }

  // ===============================
  // ALIAS VALIDATION METHODS
  // ===============================

  // Alias change handler - validate and update
  onAliasChange(newAlias?: string): void {
    if (typeof newAlias === 'undefined') return;
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    // Clean and validate the alias
    const cleanAlias = newAlias.trim().toLowerCase();
    const validation = this.validateAlias(cleanAlias, selectedNode.id);

    if (validation.valid) {
      selectedNode.alias = cleanAlias;
      console.log('Alias changed successfully:', { nodeId: selectedNode.id, newAlias: cleanAlias });
      
      // Emit node update
      this.nodeUpdate.emit(selectedNode);
    }
  }

  // Check if current node has alias error
  hasAliasError(): boolean {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return false;

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return !validation.valid;
  }

  // Get alias error message
  getAliasErrorMessage(): string {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return '';

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return validation.message || '';
  }

  // Validate alias uniqueness and format
  private validateAlias(alias: string, nodeId: string): { valid: boolean; message?: string } {
    if (!alias) {
      return { valid: false, message: 'Alias is required' };
    }

    // Check format (alphanumeric + underscore)
    if (!/^[a-z][a-z0-9_]*$/.test(alias)) {
      return { valid: false, message: 'Alias must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }

    // Check uniqueness
    const duplicateNode = this.canvasNodes.find(node => 
      node.id !== nodeId && node.alias === alias
    );

    if (duplicateNode) {
      return { valid: false, message: 'This alias is already used by another node' };
    }

    return { valid: true };
  }

  // ===============================
  // WORKFLOW VARIABLES METHODS
  // ===============================

  // Get workflow input variables
  getWorkflowInputs(): { path: string; type: string }[] {
    return this.cachedWorkflowInputs;
  }

  // Get runtime variables
  getRuntimeVariables(): { path: string; type: string }[] {
    return this.cachedRuntimeVariables;
  }

  // Get node outputs for variables (returns cached value)
  getNodeOutputs(node: WorkflowNode): { path: string; type: string }[] {
    return this.cachedNodeOutputs.get(node.id) || [];
  }

  // Get icon for node type  
  getNodeIcon(nodeType: string): "play-circle" | "user" | "gear" | "stop-circle" | "circle" {
    switch (nodeType) {
      case 'start': return 'play-circle';
      case 'agent': return 'user';
      case 'mcp': return 'gear';
      case 'end': return 'stop-circle';
      default: return 'circle';
    }
  }

  // Copy variable to clipboard
  copyToClipboard(variablePath: string): void {
    const textToCopy = `\${${variablePath}}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        console.log('Variable copied to clipboard:', textToCopy);
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Variable copied to clipboard (fallback):', textToCopy);
      } catch (err) {
        console.error('Failed to copy to clipboard (fallback):', err);
      }
      document.body.removeChild(textArea);
    }
  }

  // Abstract method for initializing node data - to be implemented by subclasses
  protected abstract initializeNodeData(node: WorkflowNode): void;
}
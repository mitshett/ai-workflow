import { Injectable } from '@angular/core';
import type { CanvasNode, CanvasEdge } from '../models/node.models';
import type {
  WorkflowExecuteRequest,
  TemporalNodeDef,
} from '../models/execution.models';

@Injectable({ providedIn: 'root' })
export class WorkflowSerializerService {
  /**
   * Convert canvas nodes + edges into a Temporal WorkflowExecuteRequest
   * (Format A — definition wrapper).
   *
   * Edge topology:
   *  - edge.sourceNodeId → edge.targetNodeId defines `next[]` for the source
   *  - reverse (targetNodeId ← sourceNodeId[]) defines `dependencies[]` for the target
   */
  serialize(
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    workflowName: string,
    inputData: Record<string, unknown> = {},
  ): WorkflowExecuteRequest {
    // Build next map: sourceNodeId → targetNodeId[]
    const nextMap = new Map<string, string[]>();
    // Build dependency map: targetNodeId → sourceNodeId[]
    const depMap = new Map<string, string[]>();

    for (const edge of edges) {
      const { sourceNodeId, targetNodeId } = edge;

      const nextList = nextMap.get(sourceNodeId) ?? [];
      nextList.push(targetNodeId);
      nextMap.set(sourceNodeId, nextList);

      const depList = depMap.get(targetNodeId) ?? [];
      depList.push(sourceNodeId);
      depMap.set(targetNodeId, depList);
    }

    const serializedNodes: TemporalNodeDef[] = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      alias: node.alias,
      name: node.label,
      description: node.description ?? '',
      config: node.config as Record<string, unknown>,
      next: nextMap.get(node.id) ?? [],
      dependencies: depMap.get(node.id) ?? [],
      trigger_rule: node.trigger_rule ?? 'all_success',
      tags: node.tags ?? [],
    }));

    const workflowId = crypto.randomUUID();

    return {
      definition: {
        id: workflowId,
        name: workflowName,
        nodes: serializedNodes,
      },
      input_data: inputData,
      execution_options: {
        max_parallel_nodes: 10,
        continue_on_failure: false,
        timeout_seconds: 600,
      },
    };
  }
}

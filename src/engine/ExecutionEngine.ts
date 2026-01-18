import { Graph, NodeInstance, NodeState } from '../types';
import { getNodeDefinition } from '../nodes';

type StateChangeCallback = (nodeId: string, state: NodeState) => void;

export class ExecutionEngine {
  private graph: Graph;
  private cache: Map<string, { hash: string; outputs: Record<string, unknown> }> = new Map();
  private onStateChange: StateChangeCallback;

  constructor(graph: Graph, onStateChange: StateChangeCallback) {
    this.graph = graph;
    this.onStateChange = onStateChange;
  }

  updateGraph(graph: Graph): void {
    this.graph = graph;
  }

  // Compute topological order for execution
  private computeExecutionOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Visit all upstream nodes first
      const upstreamConnections = this.graph.connections.filter(
        (c) => c.targetNodeId === nodeId
      );

      for (const conn of upstreamConnections) {
        visit(conn.sourceNodeId);
      }

      order.push(nodeId);
    };

    for (const node of this.graph.nodes) {
      visit(node.id);
    }

    return order;
  }

  // Gather inputs from upstream nodes
  private gatherInputs(node: NodeInstance): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingConnections = this.graph.connections.filter(
      (c) => c.targetNodeId === node.id
    );

    for (const conn of incomingConnections) {
      const sourceNode = this.graph.nodes.find((n) => n.id === conn.sourceNodeId);
      if (sourceNode?.outputs) {
        inputs[conn.targetPortId] = sourceNode.outputs[conn.sourcePortId];
      }
    }

    return inputs;
  }

  // Simple hash of inputs + parameters
  private computeHash(
    inputs: Record<string, unknown>,
    params: Record<string, unknown>
  ): string {
    return JSON.stringify({ inputs: Object.keys(inputs), params });
  }

  // Execute entire graph
  async executeGraph(): Promise<void> {
    const order = this.computeExecutionOrder();

    for (const nodeId of order) {
      await this.executeNode(nodeId);
    }
  }

  // Execute a single node (with dependencies)
  async executeNode(nodeId: string): Promise<void> {
    const node = this.graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const definition = getNodeDefinition(node.type);
    if (!definition) return;

    // Execute dependencies first
    const upstreamConnections = this.graph.connections.filter(
      (c) => c.targetNodeId === nodeId
    );

    for (const conn of upstreamConnections) {
      const sourceNode = this.graph.nodes.find((n) => n.id === conn.sourceNodeId);
      if (sourceNode && sourceNode.state !== 'complete') {
        await this.executeNode(conn.sourceNodeId);
      }
    }

    // Gather inputs
    const inputs = this.gatherInputs(node);

    // Check if all required inputs are available
    for (const port of definition.inputs) {
      if (port.required && inputs[port.id] === undefined) {
        node.state = 'error';
        node.error = `Missing required input: ${port.name}`;
        this.onStateChange(nodeId, 'error');
        return;
      }
    }

    // Check cache
    const hash = this.computeHash(inputs, node.parameters);
    const cached = this.cache.get(nodeId);

    if (cached && cached.hash === hash && node.state === 'complete') {
      node.outputs = cached.outputs;
      return;
    }

    // Execute
    node.state = 'running';
    node.error = undefined;
    this.onStateChange(nodeId, 'running');

    try {
      const startTime = performance.now();

      const outputs = await definition.execute(
        inputs,
        node.parameters,
        (progress, message) => {
          console.log(`[${node.type}] ${progress}%: ${message}`);
        }
      );

      node.outputs = outputs;
      node.executionTime = performance.now() - startTime;
      node.state = 'complete';

      // Cache result
      this.cache.set(nodeId, { hash, outputs });

      this.onStateChange(nodeId, 'complete');
    } catch (error) {
      node.state = 'error';
      node.error = error instanceof Error ? error.message : String(error);
      this.onStateChange(nodeId, 'error');
    }
  }
}

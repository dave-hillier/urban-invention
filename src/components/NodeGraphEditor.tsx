import { useCallback, useMemo, DragEvent } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';

import { Graph, NodeInstance, NodeDefinition, NodeState } from '../types';
import { getNodeDefinition, NODE_CATEGORIES, PORT_COLORS } from '../nodes';

interface NodeGraphEditorProps {
  graph: Graph;
  onChange: (graph: Graph) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onNodeDrop: (nodeType: string, position: { x: number; y: number }) => void;
}

// Custom node component
function CustomNode({ data, selected }: NodeProps) {
  const node = data.node as NodeInstance;
  const definition = data.definition as NodeDefinition;

  if (!definition) return null;

  const category = NODE_CATEGORIES.find((c) => c.id === definition.category);

  const stateColors: Record<NodeState, string> = {
    idle: 'var(--bg-tertiary)',
    stale: 'var(--warning)',
    running: 'var(--accent-secondary)',
    complete: 'var(--success)',
    error: 'var(--error)',
  };

  return (
    <div
      className="custom-node"
      style={{
        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--bg-secondary)',
        minWidth: '180px',
      }}
    >
      <div
        className="custom-node-header"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: '6px 6px 0 0',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          className="category-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: category?.color || '#666',
          }}
        />
        <span style={{ fontWeight: 500, fontSize: '13px' }}>{definition.name}</span>
        <span
          style={{
            marginLeft: 'auto',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: stateColors[node.state],
          }}
        />
      </div>

      <div style={{ padding: '8px 12px' }}>
        {/* Input ports */}
        {definition.inputs.map((port) => (
          <div
            key={port.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '4px 0',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              position: 'relative',
            }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={port.id}
              style={{
                width: '12px',
                height: '12px',
                background: PORT_COLORS[port.dataType] || '#666',
                border: '2px solid var(--bg-secondary)',
                left: '-6px',
              }}
            />
            <span>{port.name}</span>
            {!port.required && (
              <span style={{ fontSize: '10px', opacity: 0.6 }}>(opt)</span>
            )}
          </div>
        ))}

        {/* Output ports */}
        {definition.outputs.map((port) => (
          <div
            key={port.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              margin: '4px 0',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              position: 'relative',
            }}
          >
            <span>{port.name}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              style={{
                width: '12px',
                height: '12px',
                background: PORT_COLORS[port.dataType] || '#666',
                border: '2px solid var(--bg-secondary)',
                right: '-6px',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function NodeGraphEditor({
  graph,
  onChange,
  selectedNodeId,
  onSelectNode,
  onNodeDrop,
}: NodeGraphEditorProps) {
  // Convert graph to ReactFlow format
  const rfNodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: 'custom',
        position: node.position,
        data: {
          node,
          definition: getNodeDefinition(node.type),
        },
        selected: node.id === selectedNodeId,
      })),
    [graph.nodes, selectedNodeId]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      graph.connections.map((conn) => ({
        id: conn.id,
        source: conn.sourceNodeId,
        sourceHandle: conn.sourcePortId,
        target: conn.targetNodeId,
        targetHandle: conn.targetPortId,
        style: { stroke: 'var(--text-secondary)', strokeWidth: 2 },
      })),
    [graph.connections]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const updatedNodes = applyNodeChanges(changes, rfNodes);
      onChange({
        ...graph,
        nodes: graph.nodes.map((node) => {
          const updated = updatedNodes.find((n) => n.id === node.id);
          if (updated) {
            return { ...node, position: updated.position };
          }
          return node;
        }),
      });
    },
    [graph, rfNodes, onChange]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const updatedEdges = applyEdgeChanges(changes, rfEdges);
      onChange({
        ...graph,
        connections: updatedEdges.map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.source,
          sourcePortId: edge.sourceHandle || '',
          targetNodeId: edge.target,
          targetPortId: edge.targetHandle || '',
        })),
      });
    },
    [graph, rfEdges, onChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate connection types match
      const sourceNode = graph.nodes.find((n) => n.id === connection.source);
      const targetNode = graph.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceDef = getNodeDefinition(sourceNode.type);
      const targetDef = getNodeDefinition(targetNode.type);
      if (!sourceDef || !targetDef) return;

      const sourcePort = sourceDef.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetDef.inputs.find((p) => p.id === connection.targetHandle);

      if (!sourcePort || !targetPort) return;
      if (sourcePort.dataType !== targetPort.dataType) {
        console.warn(`Cannot connect ${sourcePort.dataType} to ${targetPort.dataType}`);
        return;
      }

      onChange({
        ...graph,
        connections: [
          ...graph.connections,
          {
            id: `conn-${Date.now()}`,
            sourceNodeId: connection.source!,
            sourcePortId: connection.sourceHandle!,
            targetNodeId: connection.target!,
            targetPortId: connection.targetHandle!,
          },
        ],
      });
    },
    [graph, onChange]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      // Get the position relative to the ReactFlow canvas
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      onNodeDrop(nodeType, position);
    },
    [onNodeDrop]
  );

  return (
    <div style={{ width: '100%', height: '100%' }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          style: { stroke: 'var(--text-secondary)', strokeWidth: 2 },
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}

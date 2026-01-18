import { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

import { Graph, createEmptyGraph, createNodeInstance } from './types';
import { initializeNodes, getAllNodeDefinitions, NODE_CATEGORIES, getNodeDefinition } from './nodes';
import { NodeGraphEditor } from './components/NodeGraphEditor';
import { PreviewPanel } from './components/PreviewPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { NodePalette } from './components/NodePalette';
import { ExecutionEngine } from './engine/ExecutionEngine';

// Initialize all nodes on startup
initializeNodes();

function App() {
  const [graph, setGraph] = useState<Graph>(createEmptyGraph());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'2d' | '3d'>('2d');
  const engineRef = useRef<ExecutionEngine | null>(null);

  // Initialize execution engine
  useEffect(() => {
    engineRef.current = new ExecutionEngine(graph, (nodeId, state) => {
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, state } : n)),
      }));
    });
    return () => {
      engineRef.current = null;
    };
  }, []);

  // Update engine when graph changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateGraph(graph);
    }
  }, [graph]);

  const handleExecuteAll = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.executeGraph();
      setGraph((g) => ({ ...g })); // Force re-render
    }
  }, []);

  const handleExecuteNode = useCallback(async (nodeId: string) => {
    if (engineRef.current) {
      await engineRef.current.executeNode(nodeId);
      setGraph((g) => ({ ...g })); // Force re-render
    }
  }, []);

  const handleNodeDrop = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      const definition = getNodeDefinition(nodeType);
      if (!definition) return;

      // Create default params from definition
      const defaultParams: Record<string, unknown> = {};
      for (const param of definition.parameters) {
        defaultParams[param.id] = param.default;
      }

      const newNode = createNodeInstance(nodeType, position, defaultParams);
      setGraph((g) => ({
        ...g,
        nodes: [...g.nodes, newNode],
      }));
    },
    []
  );

  const handleParamChange = useCallback((nodeId: string, params: Record<string, unknown>) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === nodeId ? { ...n, parameters: params, state: 'stale' as const } : n
      ),
    }));
  }, []);

  const handleNewGraph = useCallback(() => {
    setGraph(createEmptyGraph());
    setSelectedNodeId(null);
  }, []);

  const handleLoadTemplate = useCallback((template: 'single-city') => {
    if (template === 'single-city') {
      const blueprintNode = createNodeInstance(
        'city-blueprint',
        { x: 100, y: 200 },
        {
          seed: 12345,
          size: 25,
          walls: true,
          citadel: true,
          plaza: true,
          temple: true,
          river: false,
          coast: false,
          coastDirection: 180,
        }
      );
      const generatorNode = createNodeInstance('city-generator', { x: 400, y: 200 }, {});

      setGraph({
        nodes: [blueprintNode, generatorNode],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: blueprintNode.id,
            sourcePortId: 'blueprint',
            targetNodeId: generatorNode.id,
            targetPortId: 'blueprint',
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    }
  }, []);

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="app">
      <div className="toolbar">
        <h1>City Generator</h1>
        <button onClick={handleNewGraph}>New</button>
        <button onClick={() => handleLoadTemplate('single-city')}>Load Template</button>
        <button className="primary" onClick={handleExecuteAll}>
          Execute All
        </button>
      </div>

      <div className="main-content">
        <NodePalette
          categories={NODE_CATEGORIES}
          nodes={getAllNodeDefinitions()}
          onDragStart={(nodeType, e) => {
            e.dataTransfer.setData('application/reactflow', nodeType);
            e.dataTransfer.effectAllowed = 'move';
          }}
        />

        <div className="graph-editor">
          <ReactFlowProvider>
            <NodeGraphEditor
              graph={graph}
              onChange={setGraph}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onNodeDrop={handleNodeDrop}
            />
          </ReactFlowProvider>
        </div>

        <div className="preview-panel">
          <PreviewPanel graph={graph} selectedNodeId={selectedNodeId} mode={previewMode} onModeChange={setPreviewMode} />

          <PropertiesPanel
            node={selectedNode}
            definition={selectedNode ? getNodeDefinition(selectedNode.type) : undefined}
            onParamChange={handleParamChange}
            onExecute={handleExecuteNode}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

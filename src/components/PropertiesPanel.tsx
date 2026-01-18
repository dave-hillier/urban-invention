import { NodeInstance, NodeDefinition, ParameterDefinition, NodeState } from '../types';

interface PropertiesPanelProps {
  node: NodeInstance | undefined;
  definition: NodeDefinition | undefined;
  onParamChange: (nodeId: string, params: Record<string, unknown>) => void;
  onExecute: (nodeId: string) => void;
}

export function PropertiesPanel({
  node,
  definition,
  onParamChange,
  onExecute,
}: PropertiesPanelProps) {
  if (!node || !definition) {
    return (
      <div className="properties-panel">
        <p className="no-selection">Select a node to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <h3>{definition.name}</h3>
      <p className="description">{definition.description}</p>

      {definition.parameters.map((param) => (
        <ParameterControl
          key={param.id}
          definition={param}
          value={node.parameters[param.id] ?? param.default}
          onChange={(value) => {
            onParamChange(node.id, { ...node.parameters, [param.id]: value });
          }}
        />
      ))}

      <div className="execution-info">
        <h4>Execution</h4>
        <div className="state">
          State: <StateBadge state={node.state} />
        </div>
        {node.executionTime !== undefined && (
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Time: {node.executionTime.toFixed(0)}ms
          </div>
        )}
        {node.error && (
          <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>
            Error: {node.error}
          </div>
        )}
        <button className="execute-btn" onClick={() => onExecute(node.id)}>
          Execute
        </button>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: NodeState }) {
  return <span className={`state-badge ${state}`}>{state}</span>;
}

function ParameterControl({
  definition,
  value,
  onChange,
}: {
  definition: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (definition.type) {
    case 'number':
      return (
        <div className="param-group">
          <label>{definition.name}</label>
          <div className="param-row">
            <input
              type="range"
              min={definition.min}
              max={definition.max}
              step={definition.step || 1}
              value={value as number}
              onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <input
              type="number"
              value={value as number}
              min={definition.min}
              max={definition.max}
              step={definition.step || 1}
              onChange={(e) => onChange(parseFloat(e.target.value))}
            />
          </div>
        </div>
      );

    case 'boolean':
      return (
        <div className="param-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
            />
            {definition.name}
          </label>
        </div>
      );

    case 'enum':
      return (
        <div className="param-group">
          <label>{definition.name}</label>
          <div className="param-row">
            <select value={value as string} onChange={(e) => onChange(e.target.value)}>
              {definition.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case 'string':
      return (
        <div className="param-group">
          <label>{definition.name}</label>
          <div className="param-row">
            <input
              type="text"
              value={value as string}
              onChange={(e) => onChange(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      );

    case 'vec2':
      const vec = value as { x: number; y: number };
      return (
        <div className="param-group">
          <label>{definition.name}</label>
          <div className="param-row">
            <input
              type="number"
              value={vec.x}
              onChange={(e) => onChange({ ...vec, x: parseFloat(e.target.value) })}
              placeholder="X"
            />
            <input
              type="number"
              value={vec.y}
              onChange={(e) => onChange({ ...vec, y: parseFloat(e.target.value) })}
              placeholder="Y"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

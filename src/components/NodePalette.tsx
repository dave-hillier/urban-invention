import { DragEvent } from 'react';
import { NodeDefinition } from '../types';

interface NodePaletteProps {
  categories: { id: string; name: string; color: string }[];
  nodes: NodeDefinition[];
  onDragStart: (nodeType: string, event: DragEvent) => void;
}

export function NodePalette({ categories, nodes, onDragStart }: NodePaletteProps) {
  return (
    <div className="node-palette">
      {categories.map((category) => {
        const categoryNodes = nodes.filter((n) => n.category === category.id);
        if (categoryNodes.length === 0) return null;

        return (
          <div key={category.id}>
            <h3>{category.name}</h3>
            {categoryNodes.map((node) => (
              <div
                key={node.type}
                className="palette-node"
                draggable
                onDragStart={(e) => onDragStart(node.type, e)}
              >
                <span
                  className="color-dot"
                  style={{ background: category.color }}
                />
                <span>{node.name}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

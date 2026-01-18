import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Graph, CityLayout, WardType } from '../types';

interface PreviewPanelProps {
  graph: Graph;
  selectedNodeId: string | null;
  mode: '2d' | '3d';
  onModeChange: (mode: '2d' | '3d') => void;
}

// Ward colors for rendering
const WARD_COLORS: Record<WardType, string> = {
  alleys: '#8b7355',
  castle: '#4a5568',
  cathedral: '#9f7aea',
  market: '#f6ad55',
  farm: '#68d391',
  harbour: '#4299e1',
  park: '#48bb78',
  wilderness: '#2f855a',
};

export function PreviewPanel({ graph, mode, onModeChange }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Get city layout from graph
  const cityLayout = useMemo(() => {
    // Find a node with city output
    for (const node of graph.nodes) {
      if (node.outputs?.city) {
        return node.outputs.city as CityLayout;
      }
    }
    return null;
  }, [graph.nodes]);

  // Render the city
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!cityLayout) {
      // Draw placeholder
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No city generated yet', canvas.width / 2, canvas.height / 2);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Execute the graph to see preview', canvas.width / 2, canvas.height / 2 + 20);
      return;
    }

    // Calculate scale to fit
    const bounds = cityLayout.bounds;
    const cityWidth = bounds.maxX - bounds.minX;
    const cityHeight = bounds.maxY - bounds.minY;
    const padding = 40;
    const autoScale = Math.min(
      (canvas.width - padding * 2) / cityWidth,
      (canvas.height - padding * 2) / cityHeight
    );

    ctx.save();

    // Apply transform
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX + transform.x, centerY + transform.y);
    ctx.scale(transform.scale * autoScale, transform.scale * autoScale);
    ctx.translate(-(bounds.minX + cityWidth / 2), -(bounds.minY + cityHeight / 2));

    // Draw patches (wards)
    for (const patch of cityLayout.patches) {
      if (patch.shape.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(patch.shape[0].x, patch.shape[0].y);
      for (let i = 1; i < patch.shape.length; i++) {
        ctx.lineTo(patch.shape[i].x, patch.shape[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = WARD_COLORS[patch.ward] + (patch.withinWalls ? 'cc' : '66');
      ctx.fill();

      ctx.strokeStyle = patch.withinWalls ? '#555' : '#333';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw streets
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    for (const street of cityLayout.streets) {
      if (street.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(street[0].x, street[0].y);
      for (let i = 1; i < street.length; i++) {
        ctx.lineTo(street[i].x, street[i].y);
      }
      ctx.stroke();
    }

    // Draw walls
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    for (const wall of cityLayout.walls) {
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      ctx.lineTo(wall.end.x, wall.end.y);
      ctx.stroke();

      // Draw tower
      if (wall.hasTower) {
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.arc(wall.start.x, wall.start.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw gates
    ctx.fillStyle = '#f6ad55';
    for (const gate of cityLayout.gates) {
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw buildings
    for (const building of cityLayout.buildings) {
      if (building.footprint.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(building.footprint[0].x, building.footprint[0].y);
      for (let i = 1; i < building.footprint.length; i++) {
        ctx.lineTo(building.footprint[i].x, building.footprint[i].y);
      }
      ctx.closePath();

      let fillColor = '#5a4a3a';
      if (building.type === 'keep') fillColor = '#2d3748';
      else if (building.type === 'church') fillColor = '#805ad5';
      else if (building.type === 'tower') fillColor = '#4a5568';

      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }, [cityLayout, transform]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    setTransform((t) => ({
      ...t,
      x: t.x + dx,
      y: t.y + dy,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.1, Math.min(10, t.scale * delta)),
    }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <>
      <div className="preview-header">
        <h3>Preview</h3>
        <div className="preview-modes">
          <button className={mode === '2d' ? 'active' : ''} onClick={() => onModeChange('2d')}>
            2D
          </button>
          <button className={mode === '3d' ? 'active' : ''} onClick={() => onModeChange('3d')}>
            3D
          </button>
        </div>
      </div>
      <div
        className="preview-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      >
        <canvas ref={canvasRef} />
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            onClick={resetView}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}

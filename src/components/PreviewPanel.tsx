import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Graph, CityLayout, WardType, Polygon } from '../types';

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

// Preview data extracted from graph
interface PreviewData {
  heightmap?: { width: number; height: number; data: Float32Array };
  flowField?: { width: number; height: number; directions: Uint8Array; accumulation: Float32Array };
  rivers?: { polylines: Polygon[] };
  cityLayout?: CityLayout;
}

export function PreviewPanel({ graph, mode, onModeChange }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Extract all preview data from graph
  const previewData = useMemo((): PreviewData => {
    const data: PreviewData = {};

    for (const node of graph.nodes) {
      if (!node.outputs) continue;

      // Heightmap
      if (node.outputs.heightmap) {
        const hm = node.outputs.heightmap as { width: number; height: number; data: Float32Array };
        data.heightmap = hm;
      }

      // Flow field
      if (node.outputs.flowField) {
        const ff = node.outputs.flowField as {
          width: number;
          height: number;
          directions: Uint8Array;
          accumulation: Float32Array;
        };
        data.flowField = ff;
      }

      // Rivers
      if (node.outputs.rivers) {
        const r = node.outputs.rivers as { polylines: Polygon[] };
        data.rivers = r;
      }

      // City layout
      if (node.outputs.city) {
        data.cityLayout = node.outputs.city as CityLayout;
      }
    }

    return data;
  }, [graph.nodes]);

  // Render everything
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

    const { heightmap, flowField, rivers, cityLayout } = previewData;

    // Check if we have any data to render
    if (!heightmap && !flowField && !rivers && !cityLayout) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data generated yet', canvas.width / 2, canvas.height / 2);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Execute the graph to see preview', canvas.width / 2, canvas.height / 2 + 20);
      return;
    }

    // Determine bounds and scale
    let dataWidth = 256;
    let dataHeight = 256;

    if (heightmap) {
      dataWidth = heightmap.width;
      dataHeight = heightmap.height;
    } else if (flowField) {
      dataWidth = flowField.width;
      dataHeight = flowField.height;
    } else if (cityLayout) {
      dataWidth = cityLayout.bounds.maxX - cityLayout.bounds.minX;
      dataHeight = cityLayout.bounds.maxY - cityLayout.bounds.minY;
    }

    const padding = 20;
    const autoScale = Math.min(
      (canvas.width - padding * 2) / dataWidth,
      (canvas.height - padding * 2) / dataHeight
    );

    ctx.save();

    // Apply transform
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX + transform.x, centerY + transform.y);
    ctx.scale(transform.scale * autoScale, transform.scale * autoScale);
    ctx.translate(-dataWidth / 2, -dataHeight / 2);

    // Render heightmap as grayscale image
    if (heightmap) {
      const imageData = ctx.createImageData(heightmap.width, heightmap.height);
      for (let i = 0; i < heightmap.data.length; i++) {
        const v = Math.floor(heightmap.data[i] * 255);
        imageData.data[i * 4] = v;
        imageData.data[i * 4 + 1] = v;
        imageData.data[i * 4 + 2] = v;
        imageData.data[i * 4 + 3] = 255;
      }

      // Create temporary canvas for the image data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = heightmap.width;
      tempCanvas.height = heightmap.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(imageData, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0);
    }

    // Render flow accumulation overlay
    if (flowField && flowField.accumulation.some((v) => v > 1)) {
      // Find max accumulation for normalization
      let maxAcc = 0;
      for (let i = 0; i < flowField.accumulation.length; i++) {
        if (flowField.accumulation[i] > maxAcc) {
          maxAcc = flowField.accumulation[i];
        }
      }

      if (maxAcc > 1) {
        const imageData = ctx.createImageData(flowField.width, flowField.height);
        for (let i = 0; i < flowField.accumulation.length; i++) {
          const acc = flowField.accumulation[i];
          // Log scale for better visualization
          const v = Math.log(acc + 1) / Math.log(maxAcc + 1);
          const intensity = Math.floor(v * 255);

          // Blue color for water
          imageData.data[i * 4] = 0;
          imageData.data[i * 4 + 1] = intensity * 0.5;
          imageData.data[i * 4 + 2] = intensity;
          imageData.data[i * 4 + 3] = intensity > 20 ? 200 : 0;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = flowField.width;
        tempCanvas.height = flowField.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(imageData, 0, 0);

        ctx.drawImage(tempCanvas, 0, 0);
      }
    }

    // Render rivers
    if (rivers && rivers.polylines) {
      ctx.strokeStyle = '#4a90d9';
      ctx.lineWidth = 2 / (transform.scale * autoScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const polyline of rivers.polylines) {
        if (polyline.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i++) {
          ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        ctx.stroke();
      }
    }

    // Render city layout (if present, render on top)
    if (cityLayout) {
      // Offset for city bounds
      const offsetX = cityLayout.bounds.minX;
      const offsetY = cityLayout.bounds.minY;

      ctx.save();
      ctx.translate(-offsetX, -offsetY);

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
    }

    ctx.restore();
  }, [previewData, transform]);

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

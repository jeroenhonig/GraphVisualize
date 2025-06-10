import type { VisualizationNode, VisualizationEdge } from "@shared/schema";

export interface GraphTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface RenderOptions {
  selectedNodeId?: string;
  onNodeClick?: (node: VisualizationNode) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeContextMenu?: (e: MouseEvent, nodeId: string) => void;
  transform: GraphTransform;
}

// Simple force-directed layout simulation
export function createGraphLayout(nodes: VisualizationNode[], edges: VisualizationEdge[]): VisualizationNode[] {
  const layoutNodes = nodes.map(node => ({
    ...node,
    x: node.x || Math.random() * 800 + 100,
    y: node.y || Math.random() * 600 + 100,
    vx: 0,
    vy: 0,
  }));

  // Enhanced force simulation with better spacing
  for (let i = 0; i < 200; i++) {
    // Stronger repulsion between nodes to reduce overlap
    for (let j = 0; j < layoutNodes.length; j++) {
      for (let k = j + 1; k < layoutNodes.length; k++) {
        const node1 = layoutNodes[j];
        const node2 = layoutNodes[k];
        
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Increased repulsion force and minimum distance
        const minDistance = 150;
        if (distance < minDistance) {
          const force = (minDistance - distance) * 3;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          node1.vx -= fx * 0.1;
          node1.vy -= fy * 0.1;
          node2.vx += fx * 0.1;
          node2.vy += fy * 0.1;
        }
      }
    }

    // Moderate attraction along edges with optimal length
    edges.forEach(edge => {
      const source = layoutNodes.find(n => n.id === edge.source);
      const target = layoutNodes.find(n => n.id === edge.target);
      
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Optimal edge length for better distribution
        const optimalLength = 180;
        const force = (distance - optimalLength) * 0.02;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    // Center force to keep graph centered
    const centerX = 600;
    const centerY = 400;
    layoutNodes.forEach(node => {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * 0.002;
      node.vy += dy * 0.002;
    });

    // Apply velocity with improved damping
    layoutNodes.forEach(node => {
      node.x += node.vx * 0.8;
      node.y += node.vy * 0.8;
      node.vx *= 0.88;
      node.vy *= 0.88;
      
      // Keep nodes within bounds with more padding
      node.x = Math.max(100, Math.min(1100, node.x));
      node.y = Math.max(100, Math.min(700, node.y));
    });
  }

  return layoutNodes;
}

export function renderGraph(
  svg: SVGSVGElement,
  nodes: VisualizationNode[],
  edges: VisualizationEdge[],
  options: RenderOptions
) {
  // Clear existing content
  svg.innerHTML = '';

  const { transform, selectedNodeId, onNodeClick, onNodeDoubleClick, onNodeContextMenu } = options;

  // Create main group with transform
  const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainGroup.setAttribute(
    'transform',
    `translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`
  );
  svg.appendChild(mainGroup);

  // Create edges group
  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainGroup.appendChild(edgesGroup);

  // Create nodes group
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainGroup.appendChild(nodesGroup);

  // Render edges with curved paths
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;

    // Calculate curved path to avoid overlapping and reduce intersections
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Create curve based on distance and angle
    const curvature = Math.min(distance * 0.25, 60);
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;
    
    // Control point for the curve - offset to create natural curves
    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const controlX = midX + Math.cos(perpAngle) * curvature;
    const controlY = midY + Math.sin(perpAngle) * curvature;

    // Create curved path using quadratic Bézier curve
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = `M ${sourceNode.x} ${sourceNode.y} Q ${controlX} ${controlY} ${targetNode.x} ${targetNode.y}`;
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', 'hsl(215, 30%, 55%)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.75');
    path.setAttribute('stroke-linecap', 'round');
    path.classList.add('transition-all', 'duration-200');
    
    // Add subtle shadow for depth
    const shadowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shadowPath.setAttribute('d', pathData);
    shadowPath.setAttribute('stroke', 'rgba(0,0,0,0.08)');
    shadowPath.setAttribute('stroke-width', '5');
    shadowPath.setAttribute('fill', 'none');
    shadowPath.setAttribute('stroke-linecap', 'round');
    edgesGroup.appendChild(shadowPath);
    
    // Add edge label if exists
    if (edge.label) {
      const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelText.setAttribute('x', controlX.toString());
      labelText.setAttribute('y', (controlY + 4).toString());
      labelText.setAttribute('text-anchor', 'middle');
      labelText.setAttribute('class', 'text-xs fill-gray-700 font-medium pointer-events-none');
      labelText.textContent = edge.label;
      
      // Background circle for label readability
      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      labelBg.setAttribute('cx', controlX.toString());
      labelBg.setAttribute('cy', controlY.toString());
      labelBg.setAttribute('r', '14');
      labelBg.setAttribute('fill', 'white');
      labelBg.setAttribute('opacity', '0.9');
      labelBg.setAttribute('stroke', 'hsl(215, 20%, 75%)');
      labelBg.setAttribute('stroke-width', '1');
      
      edgesGroup.appendChild(labelBg);
      edgesGroup.appendChild(labelText);
    }

    edgesGroup.appendChild(path);
  });

  // Render nodes
  nodes.forEach(node => {
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    nodeGroup.setAttribute('data-node-id', node.id);
    nodeGroup.classList.add('cursor-pointer', 'transition-all', 'duration-200');
    
    // Node shape based on type
    const isSelected = node.id === selectedNodeId;
    const nodeColor = getNodeColor(node.type);
    const strokeWidth = isSelected ? '4' : '3';
    const strokeColor = isSelected ? 'hsl(210, 100%, 50%)' : '#FFFFFF';

    if (node.type === 'project') {
      // Rectangle for projects
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '-20');
      rect.setAttribute('y', '-20');
      rect.setAttribute('width', '40');
      rect.setAttribute('height', '40');
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', nodeColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(rect);
    } else if (node.type === 'team') {
      // Diamond for teams
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0,-20 20,0 0,20 -20,0');
      polygon.setAttribute('fill', nodeColor);
      polygon.setAttribute('stroke', strokeColor);
      polygon.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(polygon);
    } else {
      // Circle for default/users/managers
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.type === 'manager' ? '18' : '20');
      circle.setAttribute('fill', nodeColor);
      circle.setAttribute('stroke', strokeColor);
      circle.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(circle);
    }

    // Node label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('y', '35');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'text-xs font-mono fill-gray-700 pointer-events-none');
    text.textContent = node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label;
    nodeGroup.appendChild(text);

    // Event handlers
    nodeGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      onNodeClick?.(node);
    });

    nodeGroup.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      onNodeDoubleClick?.(node.id);
    });

    nodeGroup.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onNodeContextMenu?.(e as MouseEvent, node.id);
    });

    // Hover effects
    nodeGroup.addEventListener('mouseenter', () => {
      nodeGroup.style.filter = 'brightness(1.1)';
      nodeGroup.style.transform = `translate(${node.x}px, ${node.y}px) scale(1.05)`;
    });

    nodeGroup.addEventListener('mouseleave', () => {
      nodeGroup.style.filter = '';
      nodeGroup.style.transform = `translate(${node.x}px, ${node.y}px) scale(1)`;
    });

    nodesGroup.appendChild(nodeGroup);
  });
}

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    'default': 'hsl(261, 83%, 69%)', // Purple
    'user': 'hsl(261, 83%, 69%)',
    'project': 'hsl(142, 76%, 56%)', // Green
    'team': 'hsl(45, 93%, 58%)', // Yellow
    'manager': 'hsl(261, 83%, 69%)',
    'resource': 'hsl(215, 20%, 65%)', // Gray
    'department': 'hsl(0, 84%, 60%)', // Red
  };
  return colors[type.toLowerCase()] || colors.default;
}

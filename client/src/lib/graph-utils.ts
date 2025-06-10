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

  // Simple force simulation
  for (let i = 0; i < 100; i++) {
    // Repulsion between nodes
    for (let j = 0; j < layoutNodes.length; j++) {
      for (let k = j + 1; k < layoutNodes.length; k++) {
        const node1 = layoutNodes[j];
        const node2 = layoutNodes[k];
        
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = 1000 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        node1.vx -= fx;
        node1.vy -= fy;
        node2.vx += fx;
        node2.vy += fy;
      }
    }

    // Attraction along edges
    edges.forEach(edge => {
      const source = layoutNodes.find(n => n.id === edge.source);
      const target = layoutNodes.find(n => n.id === edge.target);
      
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = distance * 0.01;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    // Apply velocity and damping
    layoutNodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.9;
      node.vy *= 0.9;
      
      // Keep nodes within bounds
      node.x = Math.max(50, Math.min(1150, node.x));
      node.y = Math.max(50, Math.min(750, node.y));
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

  const { transform, selectedNodeId, onNodeClick, onNodeDoubleClick } = options;

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

  // Render edges
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', sourceNode.x.toString());
    line.setAttribute('y1', sourceNode.y.toString());
    line.setAttribute('x2', targetNode.x.toString());
    line.setAttribute('y2', targetNode.y.toString());
    line.setAttribute('stroke', 'hsl(215, 20%, 65%)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('opacity', '0.6');
    line.classList.add('transition-all', 'duration-200');
    
    // Add edge label if exists
    if (edge.label) {
      line.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title')).textContent = edge.label;
    }

    edgesGroup.appendChild(line);
  });

  // Render nodes
  nodes.forEach(node => {
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);
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

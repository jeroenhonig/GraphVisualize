import type { VisualizationNode, VisualizationEdge } from "@shared/schema";
import { getNodeTypeColor, shouldGroupNodeTypes } from "./color-utils";

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

// Neutron-repellent physics-based layout with automatic node positioning
export function createGraphLayout(nodes: VisualizationNode[], edges: VisualizationEdge[]): VisualizationNode[] {
  // Initialize nodes with random positions if not set
  const layoutNodes = nodes.map(node => ({
    ...node,
    x: node.x || Math.random() * 1000 + 200,
    y: node.y || Math.random() * 600 + 200,
    vx: 0,
    vy: 0,
    mass: 1,
  }));

  // Calculate node degrees for mass and force calculations
  const nodeDegrees = new Map<string, number>();
  layoutNodes.forEach(node => {
    const degree = edges.filter(edge => edge.source === node.id || edge.target === node.id).length;
    nodeDegrees.set(node.id, degree);
    // Higher degree nodes have more "mass" - they're harder to move
    node.mass = 1 + Math.sqrt(degree) * 0.5;
  });

  // Physics simulation with neutron-repellent forces
  for (let iteration = 0; iteration < 300; iteration++) {
    // Reset forces
    layoutNodes.forEach(node => {
      node.vx *= 0.9; // Damping
      node.vy *= 0.9;
    });

    // Apply repulsive forces between all nodes (like neutrons repelling)
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const nodeA = layoutNodes[i];
        const nodeB = layoutNodes[j];
        
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Coulomb-like repulsion force: F = k * (q1 * q2) / r^2
        // Each node has a "charge" based on its visual size
        const chargeA = Math.max(nodeA.label?.length || 10, 10) * 2;
        const chargeB = Math.max(nodeB.label?.length || 10, 10) * 2;
        const repulsionConstant = 8000;
        
        const repulsionForce = repulsionConstant * (chargeA * chargeB) / (distance * distance);
        const fx = (dx / distance) * repulsionForce;
        const fy = (dy / distance) * repulsionForce;
        
        // Apply forces inversely proportional to mass
        nodeA.vx -= fx / nodeA.mass;
        nodeA.vy -= fy / nodeA.mass;
        nodeB.vx += fx / nodeB.mass;
        nodeB.vy += fy / nodeB.mass;
      }
    }

    // Apply attractive forces along edges (like springs)
    edges.forEach(edge => {
      const sourceNode = layoutNodes.find(n => n.id === edge.source);
      const targetNode = layoutNodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Spring force with ideal length based on node degrees
        const sourceDegree = nodeDegrees.get(sourceNode.id) || 1;
        const targetDegree = nodeDegrees.get(targetNode.id) || 1;
        const idealLength = 120 + (sourceDegree + targetDegree) * 8; // Longer for high-degree nodes
        
        const springConstant = 0.1;
        const displacement = distance - idealLength;
        const springForce = springConstant * displacement;
        
        const fx = (dx / distance) * springForce;
        const fy = (dy / distance) * springForce;
        
        sourceNode.vx += fx / sourceNode.mass;
        sourceNode.vy += fy / sourceNode.mass;
        targetNode.vx -= fx / targetNode.mass;
        targetNode.vy -= fy / targetNode.mass;
      }
    });

    // Apply weak centering force to prevent drift
    const centerX = 600;
    const centerY = 400;
    layoutNodes.forEach(node => {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      const centeringForce = 0.001;
      
      node.vx += dx * centeringForce;
      node.vy += dy * centeringForce;
    });

    // Update positions based on velocities
    layoutNodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      
      // Keep nodes within reasonable bounds
      node.x = Math.max(50, Math.min(1150, node.x));
      node.y = Math.max(50, Math.min(750, node.y));
    });

    // Log progress every 50 iterations
    if (iteration % 50 === 0) {
      console.log(`Neutron-repellent layout iteration ${iteration}: optimizing node positions`);
    }
  }

  return layoutNodes;
}

// Extended node type with physics properties
interface PhysicsNode extends VisualizationNode {
  vx?: number;
  vy?: number;
}

// Real-time physics simulation for particle-like behavior
export function simulatePhysicsStep(
  nodes: VisualizationNode[], 
  edges: VisualizationEdge[],
  bounds: { width: number; height: number }
): VisualizationNode[] {
  const updatedNodes: PhysicsNode[] = nodes.map(node => ({ 
    ...node, 
    vx: node.vx || 0, 
    vy: node.vy || 0 
  }));

  // Apply forces between nodes
  for (let i = 0; i < updatedNodes.length; i++) {
    for (let j = i + 1; j < updatedNodes.length; j++) {
      const nodeA = updatedNodes[i];
      const nodeB = updatedNodes[j];
      
      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      // Repulsion force
      const repulsionForce = 500 / (distance * distance);
      const fx = (dx / distance) * repulsionForce;
      const fy = (dy / distance) * repulsionForce;
      
      nodeA.vx! -= fx;
      nodeA.vy! -= fy;
      nodeB.vx! += fx;
      nodeB.vy! += fy;
    }
  }

  // Apply spring forces along edges
  edges.forEach(edge => {
    const source = updatedNodes.find(n => n.id === edge.source);
    const target = updatedNodes.find(n => n.id === edge.target);
    
    if (source && target) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const idealLength = 150;
      const springForce = (distance - idealLength) * 0.1;
      const fx = (dx / distance) * springForce;
      const fy = (dy / distance) * springForce;
      
      source.vx! += fx;
      source.vy! += fy;
      target.vx! -= fx;
      target.vy! -= fy;
    }
  });

  // Update positions and apply damping
  updatedNodes.forEach(node => {
    node.vx! *= 0.8; // Damping
    node.vy! *= 0.8;
    
    node.x += node.vx!;
    node.y += node.vy!;
    
    // Keep within bounds
    node.x = Math.max(50, Math.min(bounds.width - 50, node.x));
    node.y = Math.max(50, Math.min(bounds.height - 50, node.y));
  });

  return updatedNodes as VisualizationNode[];
}

// Optimized edge label positioning to minimize crossings
function calculateOptimalEdgeLabelPositions(
  edges: VisualizationEdge[], 
  nodes: VisualizationNode[]
): Map<string, { x: number, y: number }> {
  const labelPositions = new Map<string, { x: number, y: number }>();
  
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode || !edge.label) return;
    
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    // Try different curvature values to find best position for label
    const curvatureOptions = [
      distance * 0.2,   // Less curved
      distance * 0.4,   // More curved
      distance * 0.6,   // Very curved
      -distance * 0.2,  // Curve other direction
      -distance * 0.4,  // More curved other direction
      -distance * 0.6,  // Very curved other direction
      0                 // Straight line
    ];
    
    let bestCurvature = distance * 0.25;
    let minConflicts = Infinity;
    
    for (const curvature of curvatureOptions) {
      const perpAngle = angle + Math.PI / 2;
      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;
      const testX = midX + Math.cos(perpAngle) * curvature;
      const testY = midY + Math.sin(perpAngle) * curvature;
      
      let conflicts = 0;
      
      // Check conflicts with nodes
      for (const node of nodes) {
        const nodeDx = Math.abs(testX - node.x);
        const nodeDy = Math.abs(testY - node.y);
        if (nodeDx < 50 && nodeDy < 30) conflicts++;
      }
      
      // Check conflicts with other edge labels
      const labelPositionsArray = Array.from(labelPositions.values());
      for (const otherPos of labelPositionsArray) {
        const labelDx = Math.abs(testX - otherPos.x);
        const labelDy = Math.abs(testY - otherPos.y);
        if (labelDx < 60 && labelDy < 25) conflicts++;
      }
      
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestCurvature = curvature;
      }
    }
    
    // Calculate final position
    const perpAngle = angle + Math.PI / 2;
    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const finalX = midX + Math.cos(perpAngle) * bestCurvature;
    const finalY = midY + Math.sin(perpAngle) * bestCurvature;
    
    labelPositions.set(edge.id, { x: finalX, y: finalY });
  });
  
  return labelPositions;
}

// Main rendering function with neutron-repellent layout
export function renderGraph(
  svg: SVGSVGElement,
  nodes: VisualizationNode[],
  edges: VisualizationEdge[],
  options: RenderOptions
): void {
  // Clear previous content
  svg.innerHTML = '';
  
  // Apply transformation
  const transformedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  transformedSvg.setAttribute('transform', 
    `translate(${options.transform.translateX}, ${options.transform.translateY}) scale(${options.transform.scale})`);
  svg.appendChild(transformedSvg);
  
  // Create groups for edges and nodes
  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  transformedSvg.appendChild(edgesGroup);
  transformedSvg.appendChild(nodesGroup);
  
  // Calculate optimal edge label positions
  const edgeLabelPositions = calculateOptimalEdgeLabelPositions(edges, nodes);
  
  // Render edges with optimized curves
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;

    const labelPos = edgeLabelPositions.get(edge.id);
    const controlX = labelPos?.x || (sourceNode.x + targetNode.x) / 2;
    const controlY = labelPos?.y || (sourceNode.y + targetNode.y) / 2;

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
    
    // Add edge label if exists with optimized position
    if (edge.label && labelPos) {
      // Create label background for better readability
      const maxEdgeLabelLength = 18;
      const labelText = edge.label.length > maxEdgeLabelLength ? edge.label.substring(0, maxEdgeLabelLength) + '...' : edge.label;
      const labelWidth = labelText.length * 6 + 12;
      
      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      labelBg.setAttribute('x', (labelPos.x - labelWidth/2).toString());
      labelBg.setAttribute('y', (labelPos.y - 8).toString());
      labelBg.setAttribute('width', labelWidth.toString());
      labelBg.setAttribute('height', '16');
      labelBg.setAttribute('rx', '4');
      labelBg.setAttribute('fill', 'rgba(255, 255, 255, 0.95)');
      labelBg.setAttribute('stroke', 'hsl(215, 20%, 75%)');
      labelBg.setAttribute('stroke-width', '1');
      
      const labelTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelTextEl.setAttribute('x', labelPos.x.toString());
      labelTextEl.setAttribute('y', (labelPos.y + 3).toString());
      labelTextEl.setAttribute('text-anchor', 'middle');
      labelTextEl.setAttribute('class', 'text-xs fill-gray-700 font-medium pointer-events-auto cursor-pointer');
      labelTextEl.textContent = labelText;
      
      // Add tooltip functionality if text is truncated
      if (edge.label.length > maxEdgeLabelLength) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = edge.label;
        labelTextEl.appendChild(title);
      }
      
      edgesGroup.appendChild(labelBg);
      edgesGroup.appendChild(labelTextEl);
    }

    edgesGroup.appendChild(path);
  });

  // Render nodes with optimized positioning
  nodes.forEach(node => {
    const isSelected = node.id === options.selectedNodeId;
    const { color, bgColor } = getNodeTypeColor(node.type);
    
    // Create node group
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    nodeGroup.style.cursor = 'pointer';
    
    // Main node circle with enhanced styling
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', isSelected ? '18' : '15');
    circle.setAttribute('fill', bgColor);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isSelected ? '4' : '2');
    circle.setAttribute('opacity', '0.9');
    circle.classList.add('transition-all', 'duration-200');
    
    if (isSelected) {
      circle.setAttribute('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
    }
    
    nodeGroup.appendChild(circle);

    // Calculate optimal label position to avoid overlap
    const labelPositions = [
      { x: 0, y: 35, anchor: 'middle' },    // Below (default)
      { x: 0, y: -30, anchor: 'middle' },   // Above
      { x: 30, y: 5, anchor: 'start' },     // Right
      { x: -30, y: 5, anchor: 'end' }       // Left
    ];

    // Find best position by checking for overlaps with other nodes and edge labels
    let bestPosition = labelPositions[0];
    let minConflicts = Infinity;

    for (const pos of labelPositions) {
      let conflicts = 0;
      const labelX = node.x + pos.x;
      const labelY = node.y + pos.y;

      // Check conflicts with other nodes
      for (const otherNode of nodes) {
        if (otherNode.id === node.id) continue;
        
        const dx = Math.abs(labelX - otherNode.x);
        const dy = Math.abs(labelY - otherNode.y);
        
        // Consider both node circle and label area
        if (dx < 60 && dy < 30) {
          conflicts++;
        }
      }

      // Check conflicts with edge label positions
      for (const edge of edges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode && edge.label) {
          // Calculate edge label position (curve midpoint)
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const curvature = Math.min(distance * 0.25, 60);
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + Math.PI / 2;
          
          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;
          const edgeLabelX = midX + Math.cos(perpAngle) * curvature;
          const edgeLabelY = midY + Math.sin(perpAngle) * curvature;
          
          // Check if node label would conflict with edge label
          const edgeDx = Math.abs(labelX - edgeLabelX);
          const edgeDy = Math.abs(labelY - edgeLabelY);
          
          if (edgeDx < 40 && edgeDy < 20) {
            conflicts += 2; // Higher penalty for edge label conflicts
          }
        }
      }

      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestPosition = pos;
      }
    }

    // Create label background for better readability
    const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const maxLabelLength = 20;
    const labelText = node.label.length > maxLabelLength ? node.label.substring(0, maxLabelLength) + '...' : node.label;
    const textWidth = labelText.length * 7 + 8;
    
    textBg.setAttribute('x', (bestPosition.x - textWidth/2).toString());
    textBg.setAttribute('y', (bestPosition.y - 10).toString());
    textBg.setAttribute('width', textWidth.toString());
    textBg.setAttribute('height', '16');
    textBg.setAttribute('rx', '3');
    textBg.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
    textBg.setAttribute('stroke', 'rgba(0, 0, 0, 0.1)');
    textBg.setAttribute('stroke-width', '0.5');
    nodeGroup.appendChild(textBg);

    // Node label with optimized position and tooltip
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', bestPosition.x.toString());
    text.setAttribute('y', (bestPosition.y - 2).toString());
    text.setAttribute('text-anchor', bestPosition.anchor);
    text.setAttribute('class', 'text-xs font-medium fill-gray-800 pointer-events-auto cursor-pointer');
    text.textContent = labelText;
    
    // Add tooltip functionality if text is truncated
    if (node.label.length > maxLabelLength) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = node.label;
      text.appendChild(title);
    }
    
    nodeGroup.appendChild(text);

    // Simple event handlers - prioritize double-click
    let clickCount = 0;
    let clickTimer: NodeJS.Timeout | null = null;

    nodeGroup.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      clickCount++;
      
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          if (clickCount === 1) {
            options.onNodeClick?.(node);
          }
          clickCount = 0;
        }, 250);
      } else if (clickCount === 2) {
        if (clickTimer) {
          clearTimeout(clickTimer);
        }
        options.onNodeDoubleClick?.(node.id);
        clickCount = 0;
      }
    });

    nodeGroup.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      options.onNodeContextMenu?.(e as MouseEvent, node.id);
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
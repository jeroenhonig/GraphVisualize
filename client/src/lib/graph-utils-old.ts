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

}
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
    vx: (node as PhysicsNode).vx || 0, 
    vy: (node as PhysicsNode).vy || 0 
  }));
  const dt = 0.032; // Faster simulation timestep
  
  // Apply forces to each node
  updatedNodes.forEach((node, i) => {
    let fx = 0, fy = 0;
    
    // Repulsion from other nodes (particle physics)
    updatedNodes.forEach((other, j) => {
      if (i === j) return;
      
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      // Strong repulsion force (inverse square law)
      const repulsionStrength = 25000;
      const minDistance = 120;
      const force = distance < minDistance ? 
        repulsionStrength / (distance * distance) + (minDistance - distance) * 10 :
        repulsionStrength / (distance * distance);
      const normalizedFx = (dx / distance) * force;
      const normalizedFy = (dy / distance) * force;
      
      fx += normalizedFx;
      fy += normalizedFy;
    });
    
    // Attraction along edges (spring forces)
    edges.forEach(edge => {
      let isConnected = false;
      let connectedNode = null;
      
      if (edge.source === node.id) {
        connectedNode = updatedNodes.find(n => n.id === edge.target);
        isConnected = true;
      } else if (edge.target === node.id) {
        connectedNode = updatedNodes.find(n => n.id === edge.source);
        isConnected = true;
      }
      
      if (isConnected && connectedNode) {
        const dx = connectedNode.x - node.x;
        const dy = connectedNode.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Spring force with optimal length
        const springLength = 200;
        const springStrength = 0.12;
        const displacement = distance - springLength;
        const force = displacement * springStrength;
        
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      }
    });
    
    // Center attraction (weak gravity)
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const centerDx = centerX - node.x;
    const centerDy = centerY - node.y;
    fx += centerDx * 0.0001;
    fy += centerDy * 0.0001;
    
    // Boundary forces (keep nodes on screen)
    const margin = 150;
    if (node.x < margin) fx += (margin - node.x) * 0.02;
    if (node.x > bounds.width - margin) fx -= (node.x - (bounds.width - margin)) * 0.02;
    if (node.y < margin) fy += (margin - node.y) * 0.02;
    if (node.y > bounds.height - margin) fy -= (node.y - (bounds.height - margin)) * 0.02;
    
    // Update velocity and position
    node.vx = (node.vx || 0) + fx * dt;
    node.vy = (node.vy || 0) + fy * dt;
    
    // Apply damping (less damping = faster movement)
    node.vx *= 0.92;
    node.vy *= 0.92;
    
    // Limit maximum velocity
    const maxVelocity = 150;
    const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (velocity > maxVelocity) {
      node.vx = (node.vx / velocity) * maxVelocity;
      node.vy = (node.vy / velocity) * maxVelocity;
    }
    
    // Update position
    node.x += node.vx * dt;
    node.y += node.vy * dt;
    
    // Keep within bounds
    node.x = Math.max(margin, Math.min(bounds.width - margin, node.x));
    node.y = Math.max(margin, Math.min(bounds.height - margin, node.y));
  });
  
  return updatedNodes;
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

  // Calculate optimal edge label positions to avoid conflicts
  const edgeLabelPositions = new Map<string, {x: number, y: number}>();
  
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;

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
    
    if (edge.label) {
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
        const labelPositionsArray = Array.from(edgeLabelPositions.values());
        for (const otherPos of labelPositionsArray) {
          const edgeDx = Math.abs(testX - otherPos.x);
          const edgeDy = Math.abs(testY - otherPos.y);
          if (edgeDx < 80 && edgeDy < 35) conflicts += 2;
        }
        
        if (conflicts < minConflicts) {
          minConflicts = conflicts;
          bestCurvature = curvature;
        }
      }
    }
    
    // Calculate final positions
    const curvature = Math.max(Math.min(bestCurvature, 80), -80); // Limit curvature
    const perpAngle = angle + Math.PI / 2;
    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const controlX = midX + Math.cos(perpAngle) * curvature;
    const controlY = midY + Math.sin(perpAngle) * curvature;
    
    // Store edge label position
    if (edge.label) {
      edgeLabelPositions.set(edge.id, {x: controlX, y: controlY});
    }
  });

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

  // Render nodes
  nodes.forEach(node => {
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    nodeGroup.setAttribute('data-node-id', node.id);
    nodeGroup.classList.add('cursor-pointer', 'transition-all', 'duration-200');
    
    // Node shape based on type with color coding
    const isSelected = node.id === selectedNodeId;
    const typeColors = getNodeTypeColor(node.type);
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
      rect.setAttribute('fill', typeColors.primary);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(rect);
    } else if (node.type === 'team') {
      // Diamond for teams
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0,-20 20,0 0,20 -20,0');
      polygon.setAttribute('fill', typeColors.primary);
      polygon.setAttribute('stroke', strokeColor);
      polygon.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(polygon);
    } else {
      // Circle for default/users/managers
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.type === 'manager' ? '18' : '20');
      circle.setAttribute('fill', typeColors.primary);
      circle.setAttribute('stroke', strokeColor);
      circle.setAttribute('stroke-width', strokeWidth);
      nodeGroup.appendChild(circle);
    }

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
      e.stopPropagation();
      clickCount++;
      
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          // Single click after delay
          onNodeClick?.(node);
          clickCount = 0;
        }, 300);
      } else if (clickCount === 2) {
        // Double click detected
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        clickCount = 0;
        console.log('Double click detected on node:', node.id);
        onNodeDoubleClick?.(node.id);
      }
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



import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from 'd3';
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";

interface ContextMenuProps {
  x: number;
  y: number;
  node: VisualizationNode;
  onEdit: () => void;
  onCreateRelation: () => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, node, onEdit, onCreateRelation, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[150px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={onEdit}
        >
          <span>✏️</span>
          Bewerk node
        </button>
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={onCreateRelation}
        >
          <span>🔗</span>
          Nieuwe relatie
        </button>
        <div className="border-t border-gray-200 my-1"></div>
        <div className="px-3 py-1 text-xs text-gray-500">
          {node.type}: {node.label}
        </div>
      </div>
    </div>
  );
};

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edge: any;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({ x, y, edge, onEdit, onDelete, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[150px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={onEdit}
        >
          <span>✏️</span>
          Bewerk relatie
        </button>
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
          onClick={onDelete}
        >
          <span>🗑️</span>
          Verwijder relatie
        </button>
        <div className="border-t border-gray-200 my-1"></div>
        <div className="px-3 py-1 text-xs text-gray-500">
          {edge.label || edge.type}
        </div>
      </div>
    </div>
  );
};

interface RDFGraphCanvasProps {
  graph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeEdit?: (node: VisualizationNode) => void;
  visibleNodes: Set<string>;
  onVisibleNodesChange: (nodes: Set<string>) => void;
  transform: GraphTransform;
  onTransformChange: (transform: GraphTransform) => void;
  editMode?: boolean;
  behaviorMode?: 'default' | 'connect' | 'select' | 'edit' | 'readonly';
  onNodesSelected?: (nodes: VisualizationNode[]) => void;
  onEdgeCreated?: (source: string, target: string) => void;
  onEdgeCreatedCallback?: (sourceId: string, targetId: string, edgeData: any) => void;
}

interface D3Node extends VisualizationNode {
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  label?: string;
}

const RDFGraphCanvas = React.memo(({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeExpand,
  onNodeEdit,
  visibleNodes,
  onVisibleNodesChange,
  transform,
  onTransformChange,
  editMode = false,
  behaviorMode = 'default',
  onNodesSelected,
  onEdgeCreated,
  onEdgeCreatedCallback
}: RDFGraphCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: VisualizationNode;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number;
    y: number;
    edge: any;
  } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [preservedViewport, setPreservedViewport] = useState<{
    transform?: d3.ZoomTransform;
    nodePositions?: Map<string, { x: number; y: number }>;
  }>({});
  const connectionModeRef = useRef<{
    active: boolean;
    sourceNode?: VisualizationNode;
  }>({ active: false });
  
  // Expose fitToScreen function globally
  useEffect(() => {
    (window as any).fitToScreenD3 = () => {
      if (!svgRef.current || !nodesDataRef.current || nodesDataRef.current.length === 0) return;
      
      const svg = d3.select(svgRef.current);
      const g = svg.select('.main-group');
      
      // Get the visible nodes bounds
      const visibleNodesArray = nodesDataRef.current.filter(node => 
        visibleNodes.has(node.id) && node.x !== undefined && node.y !== undefined
      );
      
      if (visibleNodesArray.length === 0) return;
      
      // Calculate bounding box of all visible nodes
      const padding = 100;
      const minX = Math.min(...visibleNodesArray.map(n => n.x!)) - padding;
      const maxX = Math.max(...visibleNodesArray.map(n => n.x!)) + padding;
      const minY = Math.min(...visibleNodesArray.map(n => n.y!)) - padding;
      const maxY = Math.max(...visibleNodesArray.map(n => n.y!)) + padding;
      
      const width = maxX - minX;
      const height = maxY - minY;
      
      // Get SVG dimensions
      const svgRect = svg.node()!.getBoundingClientRect();
      const svgWidth = svgRect.width;
      const svgHeight = svgRect.height;
      
      // Calculate scale to fit with some margin
      const scaleX = svgWidth / width;
      const scaleY = svgHeight / height;
      const scale = Math.min(scaleX, scaleY, 3) * 0.8; // 80% of max scale for margin
      
      // Calculate center translation
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const translateX = svgWidth / 2 - centerX * scale;
      const translateY = svgHeight / 2 - centerY * scale;
      
      // Apply the transform using D3 zoom
      if (zoomRef.current) {
        const transform = d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale);
        
        svg.transition()
          .duration(750)
          .call(zoomRef.current.transform, transform);
      }
    };
    
    return () => {
      delete (window as any).fitToScreenD3;
    };
  }, [visibleNodes]);
  
  const [connectionMode, setConnectionMode] = useState<{
    active: boolean;
    sourceNode?: VisualizationNode;
  }>({ active: false });
  const [renderError, setRenderError] = useState<string | null>(null);

  // D3 selections
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link>>();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const linksDataRef = useRef<D3Link[]>([]);
  const nodesDataRef = useRef<D3Node[]>([]);

  const createVisualization = useCallback(() => {
    if (!containerRef.current || !svgRef.current || !graph?.nodes?.length) return;

    try {
      setIsLoading(true);
      setRenderError(null);

      const container = containerRef.current;
      const svg = d3.select(svgRef.current);
      const rect = container.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 600;

      // Clear previous content
      svg.selectAll("*").remove();

      // Set SVG dimensions
      svg.attr("width", width).attr("height", height);

      // Create main group for zooming
      const g = svg.append("g").attr("class", "main-group");

      // Setup zoom behavior
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
          onTransformChange({
            x: event.transform.x,
            y: event.transform.y,
            scale: event.transform.k,
            translateX: event.transform.x,
            translateY: event.transform.y
          });
        });

      svg.call(zoom);
      zoomRef.current = zoom;
      
      // Restore preserved viewport if available
      if (preservedViewport.transform) {
        svg.call(zoom.transform, preservedViewport.transform);
        // Clear preserved viewport after restoring
        setPreservedViewport({});
      }

      // Add arrow marker for edges
      const defs = svg.append("defs");
      defs.append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

      // Prepare data with better initial positioning
      const nodes: D3Node[] = graph.nodes
        .filter(node => visibleNodes.has(node.id))
        .map((node, index) => {
          // Check if we have preserved positions from a previous viewport state
          const preservedPos = preservedViewport.nodePositions?.get(node.id);
          
          let x = preservedPos?.x || node.x || 0;
          let y = preservedPos?.y || node.y || 0;
          
          // If no position is stored (0,0), arrange in a circular grid
          if (x === 0 && y === 0) {
            const cols = Math.ceil(Math.sqrt(graph.nodes.length));
            const spacing = Math.min(width, height) / (cols + 1);
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            x = (col + 1) * spacing + Math.random() * 50 - 25;
            y = (row + 1) * spacing + Math.random() * 50 - 25;
          }
          
          return {
            ...node,
            x,
            y
          };
        });

      const links: D3Link[] = graph.edges
        .filter(edge => 
          visibleNodes.has(edge.source) && visibleNodes.has(edge.target)
        )
        .map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label
        }));

      // Store data in refs for dynamic updates
      nodesDataRef.current = nodes;
      linksDataRef.current = links;

      // Create advanced force simulation with multiple force types
      const simulation = d3.forceSimulation<D3Node, D3Link>(nodes)
        // Link force - connects related nodes
        .force("link", d3.forceLink<D3Node, D3Link>(links)
          .id(d => d.id)
          .distance(d => {
            // Vary distance based on node types for better grouping
            const source = d.source as D3Node;
            const target = d.target as D3Node;
            if (source.type === target.type) return 80; // Same type closer
            return 120; // Different types further apart
          })
          .strength(d => {
            // Stronger links between same types
            const source = d.source as D3Node;
            const target = d.target as D3Node;
            return source.type === target.type ? 1.2 : 0.8;
          })
        )
        // Charge force - repulsion between nodes
        .force("charge", d3.forceManyBody()
          .strength((d: any) => {
            // Stronger repulsion for nodes with more connections
            const connections = links.filter(l => 
              (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id
            ).length;
            return Math.max(-500, -100 * (1 + connections * 0.3));
          })
          .distanceMax(300) // Limit repulsion distance
        )
        // Centering force - keeps graph centered
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
        // Collision detection - prevents node overlap
        .force("collision", d3.forceCollide()
          .radius((d: any) => {
            // Larger collision radius for important nodes
            const connections = links.filter(l => 
              (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id
            ).length;
            return Math.max(25, 15 + connections * 2);
          })
          .strength(0.8)
        )
        // X-axis positioning force for type clustering
        .force("x", d3.forceX()
          .x((d: any) => {
            // Group nodes by type along x-axis
            const typeHash = d.type.split('').reduce((hash: any, char: any) => 
              ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff, 0
            );
            return (width / 4) + (Math.abs(typeHash) % (width / 2));
          })
          .strength(0.05)
        )
        // Y-axis positioning force for hierarchical layout
        .force("y", d3.forceY()
          .y((d: any) => {
            // Arrange by node importance (connection count)
            const connections = links.filter(l => 
              (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id
            ).length;
            return height / 2 + (connections - 5) * 30;
          })
          .strength(0.03)
        );

      simulationRef.current = simulation;

      // Create links with groups for better management
      const linkGroup = g.append("g").attr("class", "links");
      const linkSelection = linkGroup.selectAll(".link-group")
        .data(links, (d: any) => d.id)
        .enter().append("g")
        .attr("class", "link-group");

      linkSelection.append("line")
        .attr("class", "link")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrow)")
        .style("cursor", "pointer")
        .on("contextmenu", (event, d) => {
          event.preventDefault();
          const rect = svgRef.current!.getBoundingClientRect();
          setEdgeContextMenu({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            edge: d
          });
          setSelectedEdge(d);
        })
        .on("click", (event, d) => {
          setSelectedEdge(selectedEdge?.id === d.id ? null : d);
        });

      linkSelection.append("text")
        .attr("class", "link-label")
        .attr("text-anchor", "middle")
        .attr("dy", "-5px")
        .attr("font-size", "10px")
        .attr("fill", "#666")
        .text(d => d.label || "");

      // Create nodes
      const nodeGroup = g.append("g").attr("class", "nodes");
      const nodeSelection = nodeGroup.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", 12)
        .attr("fill", d => getNodeColor(d.type))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer");

      // Create labels
      const labelGroup = g.append("g").attr("class", "labels");
      const labelSelection = labelGroup.selectAll("text")
        .data(nodes)
        .enter().append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-family", "Arial, sans-serif")
        .attr("fill", "#333")
        .attr("dy", 25)
        .text(d => truncateLabel(d.label, 15))
        .style("pointer-events", "none");

      // Advanced D3 force simulation interactions
      if (behaviorMode !== 'readonly') {
        // Enhanced drag behavior with magnetic clustering
        const drag = d3.drag<SVGCircleElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.5).restart();
            d.fx = d.x;
            d.fy = d.y;
            
            // Highlight connected nodes during drag
            const connectedIds = new Set(
              links.filter(l => (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id)
                   .map(l => (l.source as D3Node).id === d.id ? (l.target as D3Node).id : (l.source as D3Node).id)
            );
            
            nodeSelection.attr("opacity", n => n.id === d.id || connectedIds.has(n.id) ? 1.0 : 0.4);
            linkSelection.attr("opacity", l => 
              (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id ? 1.0 : 0.2
            );
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
            
            // Apply magnetic clustering for same-type nodes
            nodes.forEach(node => {
              if (node.id !== d.id && node.type === d.type) {
                const dx = event.x - (node.x || 0);
                const dy = event.y - (node.y || 0);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                  const magnetForce = (120 - distance) / 120 * 0.08;
                  node.vx = (node.vx || 0) + dx * magnetForce;
                  node.vy = (node.vy || 0) + dy * magnetForce;
                }
              }
            });
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.1);
            
            // Pin node if shift key held, otherwise release
            if (!event.sourceEvent.shiftKey) {
              d.fx = null;
              d.fy = null;
            }
            
            // Reset visual highlighting
            nodeSelection.attr("opacity", 1.0);
            linkSelection.attr("opacity", 0.6);
          });

        nodeSelection.call(drag);

        // Double-click expansion with force effects
        let clickTimeout: NodeJS.Timeout;
        nodeSelection
          .on("click", (event, d) => {
            event.stopPropagation();
            
            // Handle connection mode
            const currentConnectionMode = connectionModeRef.current;
            if (currentConnectionMode.active && currentConnectionMode.sourceNode) {
              if (d.id !== currentConnectionMode.sourceNode.id) {
                // Create new connection
                if (onEdgeCreated) {
                  onEdgeCreated(currentConnectionMode.sourceNode.id, d.id);
                }
                connectionModeRef.current = { active: false };
                setConnectionMode({ active: false });
                return;
              } else {
                // Clicked on same node, cancel connection mode
                connectionModeRef.current = { active: false };
                setConnectionMode({ active: false });
                return;
              }
            }
            
            // Normal click behavior
            if (clickTimeout) clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => onNodeSelect(d), 200);
          })
          .on("dblclick", (event, d) => {
            event.stopPropagation();
            if (clickTimeout) clearTimeout(clickTimeout);
            
            onNodeExpand(d.id);
            
            // Explosion effect for connected nodes
            const connectedNodes = links
              .filter(l => (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id)
              .map(l => (l.source as D3Node).id === d.id ? (l.target as D3Node) : (l.source as D3Node));
            
            connectedNodes.forEach(node => {
              const dx = (node.x || 0) - (d.x || 0);
              const dy = (node.y || 0) - (d.y || 0);
              const distance = Math.sqrt(dx * dx + dy * dy);
              const impulse = 80 / Math.max(distance, 10);
              
              node.vx = (node.vx || 0) + dx * impulse * 0.3;
              node.vy = (node.vy || 0) + dy * impulse * 0.3;
            });
            
            simulation.alpha(0.6).restart();
          });

        // Animated hover effects
        nodeSelection
          .on("mouseover", function(event, d) {
            const connectionCount = links.filter(l => 
              (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id
            ).length;
            
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", Math.max(16, 12 + connectionCount * 0.5))
              .attr("stroke-width", 3);
              
            // Enhance label visibility
            labelSelection
              .filter(n => n.id === d.id)
              .transition()
              .duration(150)
              .attr("font-size", "12px")
              .attr("font-weight", "bold");
          })
          .on("mouseout", function(event, d) {
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", 12)
              .attr("stroke-width", 2);
              
            labelSelection
              .filter(n => n.id === d.id)
              .transition()
              .duration(150)
              .attr("font-size", "10px")
              .attr("font-weight", "normal");
          });

        // Right-click context menu
        nodeSelection.on("contextmenu", (event, d) => {
          event.preventDefault();
          
          // Get mouse position relative to the page
          setContextMenu({
            x: event.pageX,
            y: event.pageY,
            node: d
          });
        });
      }

      // Update positions on simulation tick
      simulation.on("tick", () => {
        // Update link positions using the new group structure
        linkSelection.select("line")
          .attr("x1", d => (d.source as D3Node).x!)
          .attr("y1", d => (d.source as D3Node).y!)
          .attr("x2", d => (d.target as D3Node).x!)
          .attr("y2", d => (d.target as D3Node).y!)
          .attr("stroke", d => selectedEdge?.id === d.id ? "#ff6b35" : "#999")
          .attr("stroke-width", d => selectedEdge?.id === d.id ? 4 : 2);

        // Update link label positions
        linkSelection.select("text")
          .attr("x", d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
          .attr("y", d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);

        nodeSelection
          .attr("cx", d => d.x!)
          .attr("cy", d => d.y!);

        labelSelection
          .attr("x", d => d.x!)
          .attr("y", d => d.y!);
      });

      // Auto-fit viewport to show all nodes after simulation stabilizes
      simulation.on("end", () => {
        if (nodes.length > 0) {
          const bounds = {
            minX: Math.min(...nodes.map(d => d.x!)) - 50,
            maxX: Math.max(...nodes.map(d => d.x!)) + 50,
            minY: Math.min(...nodes.map(d => d.y!)) - 50,
            maxY: Math.max(...nodes.map(d => d.y!)) + 50
          };

          const graphWidth = bounds.maxX - bounds.minX;
          const graphHeight = bounds.maxY - bounds.minY;
          
          // Calculate scale to fit all nodes with some padding
          const scale = Math.min(
            (width * 0.9) / graphWidth,
            (height * 0.9) / graphHeight,
            1.5 // Maximum zoom level
          );

          // Calculate center position
          const centerX = (bounds.minX + bounds.maxX) / 2;
          const centerY = (bounds.minY + bounds.maxY) / 2;
          
          // Calculate translation to center the graph
          const translateX = width / 2 - centerX * scale;
          const translateY = height / 2 - centerY * scale;

          // Apply the transform
          const transform = d3.zoomIdentity
            .translate(translateX, translateY)
            .scale(scale);

          svg.transition()
            .duration(1000)
            .call(zoomRef.current!.transform, transform);
        }
      });

      console.log(`RDF Graph rendered with ${nodes.length} nodes and ${links.length} edges`);
      setIsLoading(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('RDF Graph creation error:', errorMessage);
      setRenderError(errorMessage);
      setIsLoading(false);
    }
  }, [graph, visibleNodes, behaviorMode, onNodeSelect, onTransformChange]);

  // Separate effect for selected node highlighting (without re-rendering the entire graph)
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const nodeSelection = svg.selectAll<SVGCircleElement, D3Node>('.node-circle');
    
    // Update node highlighting
    nodeSelection
      .attr("stroke", d => d.id === selectedNode?.id ? "#ff6b35" : "#fff")
      .attr("stroke-width", d => d.id === selectedNode?.id ? 4 : 2);
      
  }, [selectedNode]);

  // Function to add a new edge dynamically without re-rendering the entire graph
  const addEdgeDynamically = useCallback((sourceId: string, targetId: string, edgeData: any) => {
    console.log('addEdgeDynamically called with:', { sourceId, targetId, edgeData });
    
    if (!svgRef.current || !simulationRef.current || !nodesDataRef.current || !linksDataRef.current) {
      console.log('Required refs not available');
      return;
    }

    const svg = d3.select(svgRef.current);
    const g = svg.select('.main-group');
    
    // Find source and target nodes from current data
    const sourceNode = nodesDataRef.current.find(n => n.id === sourceId);
    const targetNode = nodesDataRef.current.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      console.log('Source or target node not found:', { sourceId, targetId });
      return;
    }
    
    // Create new edge data with proper D3 node references
    const newEdge: D3Link = {
      id: edgeData.edgeId || `edge-${Date.now()}`,
      source: sourceNode,
      target: targetNode,
      label: edgeData.label || "relatedTo"
    };

    // Add to links data
    linksDataRef.current.push(newEdge);
    console.log('Added new edge to links data, total links:', linksDataRef.current.length);

    // Update simulation with new links
    const simulation = simulationRef.current;
    const linkForce = simulation.force("link") as d3.ForceLink<D3Node, D3Link>;
    if (linkForce) {
      linkForce.links(linksDataRef.current);
    }

    // Update SVG with new edge using D3 data join pattern
    const linkContainer = g.select('.links');
    const linkSelection = linkContainer.selectAll('.link-group')
      .data(linksDataRef.current, (d: any) => d.id);

    // Add new link groups
    const newLinkEnter = linkSelection.enter()
      .append('g')
      .attr('class', 'link-group');

    newLinkEnter.append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    newLinkEnter.append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '-5px')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(d => d.label || '');

    // Update tick function to include new links
    simulation.on("tick", () => {
      // Update all link positions including new ones
      linkContainer.selectAll('.link-group').select("line")
        .attr("x1", (d: any) => (d.source as D3Node).x!)
        .attr("y1", (d: any) => (d.source as D3Node).y!)
        .attr("x2", (d: any) => (d.target as D3Node).x!)
        .attr("y2", (d: any) => (d.target as D3Node).y!);

      // Update all link label positions
      linkContainer.selectAll('.link-group').select("text")
        .attr("x", (d: any) => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr("y", (d: any) => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);

      // Update node positions (existing code)
      g.selectAll('.nodes circle')
        .attr("cx", d => (d as D3Node).x!)
        .attr("cy", d => (d as D3Node).y!);

      g.selectAll('.node-labels text')
        .attr("x", d => (d as D3Node).x!)
        .attr("y", d => (d as D3Node).y!);
    });

    // Restart simulation with moderate alpha to animate the new edge
    simulation.alpha(0.1).restart();
    console.log('Simulation restarted with new edge');

  }, []);

  // Expose the addEdgeDynamically function globally when component mounts
  React.useEffect(() => {
    // Always expose the function for dynamic edge creation
    (window as any).addEdgeDynamically = addEdgeDynamically;
    
    // Cleanup on unmount
    return () => {
      delete (window as any).addEdgeDynamically;
    };
  }, [addEdgeDynamically]);

  const getNodeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'Person': '#ff7f0e',
      'Organization': '#2ca02c', 
      'Place': '#d62728',
      'Resource': '#1f77b4',
      'Concept': '#9467bd',
      'Document': '#8c564b',
      'Event': '#e377c2',
      'Building': '#17becf',
      'Room': '#bcbd22',
      'Floor': '#e377c2'
    };
    return colorMap[type] || '#1f77b4';
  };

  const truncateLabel = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const fitToView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const g = svg.select('.main-group');
    const bounds = (g.node() as any)?.getBBox();
    
    if (!bounds) return;
    
    const fullWidth = +svg.attr('width');
    const fullHeight = +svg.attr('height');
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    
    if (width === 0 || height === 0) return;
    
    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
    
    svg.transition()
      .duration(750)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }, []);

  // Effects
  useEffect(() => {
    createVisualization();
    
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [createVisualization]);

  // Expose fit to view method
  useEffect(() => {
    if (graph && !isLoading) {
      const timer = setTimeout(fitToView, 1000);
      return () => clearTimeout(timer);
    }
  }, [graph, isLoading, fitToView]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-center p-8 max-w-md">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
            RDF Graph Rendering Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {renderError}
          </p>
          <button 
            onClick={createVisualization}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden relative"
      style={{ 
        minHeight: '500px',
        minWidth: '500px',
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading RDF graph... ({graph?.nodes?.length || 0} nodes)
            </p>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ display: isLoading ? 'none' : 'block' }}
      />

      {!isLoading && graph && (
        <div className="absolute top-4 left-4 text-sm text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded">
          {visibleNodes.size} nodes, {graph.edges?.filter(e => 
            visibleNodes.has(e.source) && visibleNodes.has(e.target)
          ).length || 0} edges
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onEdit={() => {
            if (onNodeEdit) {
              onNodeEdit(contextMenu.node);
            }
            setContextMenu(null);
          }}
          onCreateRelation={() => {
            const newConnectionMode = { 
              active: true, 
              sourceNode: contextMenu.node 
            };
            connectionModeRef.current = newConnectionMode;
            setConnectionMode(newConnectionMode);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edge Context Menu */}
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edge={edgeContextMenu.edge}
          onEdit={() => {
            // TODO: Implement edge editing dialog
            console.log('Edit edge:', edgeContextMenu.edge);
            setEdgeContextMenu(null);
          }}
          onDelete={async () => {
            try {
              // Delete the edge from the database using the correct endpoint
              const response = await fetch(`/api/edges/${edgeContextMenu.edge.id}`, {
                method: 'DELETE',
              });
              
              if (response.ok) {
                // Preserve current viewport and node positions before refresh
                if (svgRef.current && simulationRef.current) {
                  const svg = d3.select(svgRef.current);
                  const currentTransform = d3.zoomTransform(svg.node()!);
                  
                  // Save current node positions
                  const nodePositions = new Map<string, { x: number; y: number }>();
                  nodesDataRef.current.forEach(node => {
                    if (node.x !== undefined && node.y !== undefined) {
                      nodePositions.set(node.id, { x: node.x, y: node.y });
                    }
                  });
                  
                  setPreservedViewport({
                    transform: currentTransform,
                    nodePositions: nodePositions
                  });
                }
                
                // Force a complete graph refresh to ensure edge is properly removed
                setTimeout(() => {
                  createVisualization();
                }, 100);
                
                console.log('Edge removed successfully, refreshing visualization');
              } else {
                console.error('Failed to delete edge');
              }
            } catch (error) {
              console.error('Error deleting edge:', error);
            }
            setEdgeContextMenu(null);
            setSelectedEdge(null);
          }}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {/* Connection Mode Indicator */}
      {connectionMode.active && connectionMode.sourceNode && (
        <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
            🔗 Verbindingsmodus actief
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            Van: {connectionMode.sourceNode.label}
          </div>
          <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
            Klik op een andere node om relatie aan te maken
          </div>
          <button
            onClick={() => {
              connectionModeRef.current = { active: false };
              setConnectionMode({ active: false });
            }}
            className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Annuleren
          </button>
        </div>
      )}
    </div>
  );
});

RDFGraphCanvas.displayName = 'RDFGraphCanvas';

export default RDFGraphCanvas;
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from 'd3';
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";

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
  onEdgeCreated
}: RDFGraphCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // D3 selections
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link>>();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

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

      // Prepare data
      const nodes: D3Node[] = graph.nodes
        .filter(node => visibleNodes.has(node.id))
        .map(node => ({
          ...node,
          x: node.x || Math.random() * width,
          y: node.y || Math.random() * height
        }));

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

      // Create force simulation
      const simulation = d3.forceSimulation<D3Node, D3Link>(nodes)
        .force("link", d3.forceLink<D3Node, D3Link>(links)
          .id(d => d.id)
          .distance(100)
        )
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));

      simulationRef.current = simulation;

      // Create links
      const linkGroup = g.append("g").attr("class", "links");
      const linkSelection = linkGroup.selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrow)");

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

      // Add interactions based on behavior mode
      if (behaviorMode !== 'readonly') {
        // Drag behavior
        const drag = d3.drag<SVGCircleElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });

        nodeSelection.call(drag);

        // Click events
        nodeSelection.on("click", (event, d) => {
          event.stopPropagation();
          onNodeSelect(d);
        });

        // Hover effects
        nodeSelection
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("r", 16)
              .attr("stroke-width", 3);
          })
          .on("mouseout", function(event, d) {
            d3.select(this)
              .attr("r", 12)
              .attr("stroke-width", 2);
          });
      }

      // Update positions on simulation tick
      simulation.on("tick", () => {
        linkSelection
          .attr("x1", d => (d.source as D3Node).x!)
          .attr("y1", d => (d.source as D3Node).y!)
          .attr("x2", d => (d.target as D3Node).x!)
          .attr("y2", d => (d.target as D3Node).y!);

        nodeSelection
          .attr("cx", d => d.x!)
          .attr("cy", d => d.y!);

        labelSelection
          .attr("x", d => d.x!)
          .attr("y", d => d.y!);
      });

      // Highlight selected node
      if (selectedNode) {
        nodeSelection
          .attr("stroke", d => d.id === selectedNode.id ? "#ff6b35" : "#fff")
          .attr("stroke-width", d => d.id === selectedNode.id ? 4 : 2);
      }

      console.log(`RDF Graph rendered with ${nodes.length} nodes and ${links.length} edges`);
      setIsLoading(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('RDF Graph creation error:', errorMessage);
      setRenderError(errorMessage);
      setIsLoading(false);
    }
  }, [graph, visibleNodes, selectedNode, behaviorMode, onNodeSelect, onTransformChange]);

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
    </div>
  );
});

RDFGraphCanvas.displayName = 'RDFGraphCanvas';

export default RDFGraphCanvas;
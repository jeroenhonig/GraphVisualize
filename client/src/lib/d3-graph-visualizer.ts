import * as d3 from 'd3';
import { RDFNode, RDFLink, RDFGraphData } from './rdf-data-manager';

export interface D3GraphConfig {
  width: number;
  height: number;
  nodeRadius: number;
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
  enableZoom: boolean;
  enableDrag: boolean;
}

export interface GraphTransform {
  x: number;
  y: number;
  scale: number;
}

export class D3GraphVisualizer {
  private container: d3.Selection<HTMLElement, unknown, null, undefined>;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g: d3.Selection<SVGGElement, unknown, null, undefined>;
  private simulation: d3.Simulation<RDFNode, RDFLink>;
  private config: D3GraphConfig;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  
  private linkSelection: d3.Selection<SVGLineElement, RDFLink, SVGGElement, unknown>;
  private nodeSelection: d3.Selection<SVGCircleElement, RDFNode, SVGGElement, unknown>;
  private labelSelection: d3.Selection<SVGTextElement, RDFNode, SVGGElement, unknown>;
  
  // Event callbacks
  public onNodeClick?: (node: RDFNode, event: MouseEvent) => void;
  public onNodeHover?: (node: RDFNode | null, event: MouseEvent) => void;
  public onTransformChange?: (transform: GraphTransform) => void;

  constructor(containerId: string, config: Partial<D3GraphConfig> = {}) {
    this.config = {
      width: 800,
      height: 600,
      nodeRadius: 8,
      linkDistance: 100,
      chargeStrength: -300,
      collisionRadius: 20,
      enableZoom: true,
      enableDrag: true,
      ...config
    };

    this.container = d3.select(`#${containerId}`);
    if (this.container.empty()) {
      throw new Error(`Container with id '${containerId}' not found`);
    }

    this.setupSVG();
    this.setupForceSimulation();
    this.setupZoom();
  }

  private setupSVG(): void {
    // Clear existing content
    this.container.selectAll('*').remove();

    this.svg = this.container
      .append('svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .style('background', '#ffffff')
      .style('border', '1px solid #e5e7eb');

    // Create main group for zooming/panning
    this.g = this.svg.append('g');

    // Add arrow marker for directed edges
    this.svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');
  }

  private setupForceSimulation(): void {
    this.simulation = d3.forceSimulation<RDFNode, RDFLink>()
      .force('link', d3.forceLink<RDFNode, RDFLink>()
        .id(d => d.id)
        .distance(this.config.linkDistance)
      )
      .force('charge', d3.forceManyBody()
        .strength(this.config.chargeStrength)
      )
      .force('center', d3.forceCenter(
        this.config.width / 2, 
        this.config.height / 2
      ))
      .force('collision', d3.forceCollide()
        .radius(this.config.collisionRadius)
      );
  }

  private setupZoom(): void {
    if (!this.config.enableZoom) return;

    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        this.g.attr('transform', transform);
        
        if (this.onTransformChange) {
          this.onTransformChange({
            x: transform.x,
            y: transform.y,
            scale: transform.k
          });
        }
      });

    this.svg.call(this.zoom);
  }

  updateGraph(data: RDFGraphData): void {
    // Process data for D3
    const nodes = data.nodes.map(node => ({ ...node }));
    const links = data.links.map(link => ({ ...link }));

    // Update force simulation
    this.simulation.nodes(nodes);
    (this.simulation.force('link') as d3.ForceLink<RDFNode, RDFLink>)
      .links(links);

    // Update visual elements
    this.updateLinks(links);
    this.updateNodes(nodes);
    this.updateLabels(nodes);

    // Restart simulation
    this.simulation.alpha(1).restart();
  }

  private updateLinks(links: RDFLink[]): void {
    this.linkSelection = this.g.selectAll<SVGLineElement, RDFLink>('.link')
      .data(links, d => d.id);

    // Exit
    this.linkSelection.exit().remove();

    // Enter
    const linkEnter = this.linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    // Merge
    this.linkSelection = linkEnter.merge(this.linkSelection);

    // Add hover effects for links
    this.linkSelection
      .on('mouseover', function() {
        d3.select(this)
          .attr('stroke', '#666')
          .attr('stroke-width', 3);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#999')
          .attr('stroke-width', 1.5);
      });
  }

  private updateNodes(nodes: RDFNode[]): void {
    this.nodeSelection = this.g.selectAll<SVGCircleElement, RDFNode>('.node')
      .data(nodes, d => d.id);

    // Exit
    this.nodeSelection.exit().remove();

    // Enter
    const nodeEnter = this.nodeSelection.enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', this.config.nodeRadius)
      .attr('fill', d => this.getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // Merge
    this.nodeSelection = nodeEnter.merge(this.nodeSelection);

    // Add interactions
    this.addNodeInteractions();

    // Update simulation tick
    this.simulation.on('tick', () => {
      this.linkSelection
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      this.nodeSelection
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      this.labelSelection
        .attr('x', d => d.x!)
        .attr('y', d => d.y! + this.config.nodeRadius + 12);
    });
  }

  private updateLabels(nodes: RDFNode[]): void {
    this.labelSelection = this.g.selectAll<SVGTextElement, RDFNode>('.label')
      .data(nodes, d => d.id);

    // Exit
    this.labelSelection.exit().remove();

    // Enter
    const labelEnter = this.labelSelection.enter()
      .append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'Arial, sans-serif')
      .attr('fill', '#333')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Merge
    this.labelSelection = labelEnter.merge(this.labelSelection);

    // Update text content
    this.labelSelection.text(d => this.truncateLabel(d.label, 15));
  }

  private addNodeInteractions(): void {
    if (this.config.enableDrag) {
      const drag = d3.drag<SVGCircleElement, RDFNode>()
        .on('start', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      this.nodeSelection.call(drag);
    }

    // Click events
    this.nodeSelection
      .on('click', (event, d) => {
        event.stopPropagation();
        if (this.onNodeClick) {
          this.onNodeClick(d, event);
        }
      })
      .on('mouseover', (event, d) => {
        // Highlight node
        d3.select(event.currentTarget)
          .attr('r', this.config.nodeRadius * 1.5)
          .attr('stroke-width', 3);

        if (this.onNodeHover) {
          this.onNodeHover(d, event);
        }
      })
      .on('mouseout', (event, d) => {
        // Reset node
        d3.select(event.currentTarget)
          .attr('r', this.config.nodeRadius)
          .attr('stroke-width', 2);

        if (this.onNodeHover) {
          this.onNodeHover(null, event);
        }
      });
  }

  private getNodeColor(type: string): string {
    const colorMap: Record<string, string> = {
      'Person': '#ff7f0e',
      'Organization': '#2ca02c',
      'Place': '#d62728',
      'Resource': '#1f77b4',
      'Concept': '#9467bd',
      'Document': '#8c564b',
      'Event': '#e377c2'
    };
    
    return colorMap[type] || '#1f77b4';
  }

  private truncateLabel(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Public methods for controlling the visualization
  zoomToFit(): void {
    const bounds = this.g.node()?.getBBox();
    if (!bounds) return;

    const fullWidth = this.config.width;
    const fullHeight = this.config.height;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    if (width === 0 || height === 0) return;

    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }

  resetZoom(): void {
    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity);
  }

  highlightNodes(nodeIds: string[]): void {
    this.nodeSelection
      .attr('opacity', d => nodeIds.includes(d.id) ? 1 : 0.3)
      .attr('stroke-width', d => nodeIds.includes(d.id) ? 3 : 2);

    this.linkSelection
      .attr('opacity', d => 
        nodeIds.includes(d.source as string) || nodeIds.includes(d.target as string) ? 1 : 0.1
      );
  }

  clearHighlight(): void {
    this.nodeSelection
      .attr('opacity', 1)
      .attr('stroke-width', 2);

    this.linkSelection
      .attr('opacity', 0.6);
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    this.svg
      .attr('width', width)
      .attr('height', height);

    this.simulation
      .force('center', d3.forceCenter(width / 2, height / 2))
      .alpha(1)
      .restart();
  }

  destroy(): void {
    this.simulation.stop();
    this.container.selectAll('*').remove();
  }
}
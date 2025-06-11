// G6 v5.0.48 Official Implementation
// Based on https://github.com/antvis/G6 repository

export interface G6NodeData {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  style?: {
    fill?: string;
    stroke?: string;
    lineWidth?: number;
    size?: number;
  };
}

export interface G6EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: {
    stroke?: string;
    lineWidth?: number;
  };
}

export interface G6Data {
  nodes: G6NodeData[];
  edges: G6EdgeData[];
}

// G6 v5 requires specific configuration pattern
export const createG6Graph = (container: HTMLElement, data: G6Data, width: number, height: number) => {
  const G6 = (window as any).G6;
  
  if (!G6) {
    throw new Error('G6 library not loaded');
  }

  // G6 v5 configuration following official examples
  const graph = new G6.Graph({
    container,
    width,
    height,
    // G6 v5 requires explicit renderer specification
    renderer: {
      type: 'canvas',
    },
    layout: {
      type: 'force',
      preventOverlap: true,
      nodeSize: 30,
      linkDistance: 150,
      nodeStrength: -300,
      edgeStrength: 0.6,
      collideStrength: 0.8,
    },
    defaultNode: {
      size: 30,
      style: {
        fill: '#e6f7ff',
        stroke: '#1890ff',
        lineWidth: 2,
      },
      labelCfg: {
        style: {
          fill: '#333',
          fontSize: 12,
        },
        position: 'bottom',
        offset: 5,
      },
    },
    defaultEdge: {
      style: {
        stroke: '#91d5ff',
        lineWidth: 1,
        opacity: 0.8,
      },
    },
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    },
  });

  // G6 v5 data loading pattern
  graph.data(data);
  graph.render();

  return graph;
};

// Alternative implementation using G6 v5 Element API
export const createG6GraphWithElements = (container: HTMLElement, data: G6Data, width: number, height: number) => {
  const G6 = (window as any).G6;
  
  if (!G6) {
    throw new Error('G6 library not loaded');
  }

  const graph = new G6.Graph({
    container,
    width,
    height,
    fitView: true,
    fitViewPadding: [20, 40, 50, 20],
  });

  // Add nodes first
  data.nodes.forEach(node => {
    graph.addItem('node', {
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      style: node.style,
    });
  });

  // Add edges
  data.edges.forEach(edge => {
    graph.addItem('edge', {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      style: edge.style,
    });
  });

  return graph;
};
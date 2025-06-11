// G6 v5.0.48 Official Implementation
// Based on https://github.com/antvis/G6 v5 documentation

export interface G6NodeData {
  id: string;
  data: {
    label?: string;
    x?: number;
    y?: number;
    [key: string]: any;
  };
}

export interface G6EdgeData {
  id: string;
  source: string;
  target: string;
  data: {
    label?: string;
    [key: string]: any;
  };
}

export interface G6GraphData {
  nodes: G6NodeData[];
  edges: G6EdgeData[];
}

// G6 v5 proper configuration pattern
export const createG6v5Graph = (container: HTMLElement, data: G6GraphData, width: number, height: number) => {
  const G6 = (window as any).G6;

  if (!G6) {
    throw new Error('G6 library not loaded');
  }

  // G6 v5 configuration following official v5 API
  const graph = new G6.Graph({
    container,
    width,
    height,
    data, // G6 v5 accepts data directly in constructor
    layout: {
      type: 'force',
      preventOverlap: true,
      nodeSize: 30,
      linkDistance: 150,
      nodeStrength: -300,
      edgeStrength: 0.6,
      collideStrength: 0.8,
    },
    node: {
      style: {
        size: 30,
        fill: '#e6f7ff',
        stroke: '#1890ff',
        lineWidth: 2,
        labelText: (d: any) => d.data?.label || d.id,
        labelFill: '#333',
        labelFontSize: 12,
        labelPosition: 'bottom',
        labelOffsetY: 5,
      },
    },
    edge: {
      style: {
        stroke: '#91d5ff',
        lineWidth: 1,
        opacity: 0.8,
        labelText: (d: any) => d.data?.label || '',
        labelFill: '#333',
        labelFontSize: 10,
      },
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
  });

  return graph;
};

// G6 v5 data update methods
export const updateG6v5Data = (graph: any, data: G6GraphData) => {
  if (!graph) return;

  // G6 v5 uses setData for updates
  graph.setData(data);
  graph.render();
};

// G6 v5 resize method
export const resizeG6v5Graph = (graph: any, width: number, height: number) => {
  if (!graph) return;

  // G6 v5 uses setSize method
  graph.setSize([width, height]);
};

// G6 Graph Configuration
export interface G6LayoutConfig {
  type: 'force' | 'circular' | 'radial' | 'dagre';
  workerEnabled?: boolean;
  preventOverlap?: boolean;
  nodeSize?: number;
  linkDistance?: number;
  nodeStrength?: number;
  edgeStrength?: number;
  maxIteration?: number;
  gravity?: number;
  center?: [number, number];
  alphaDecay?: number;
  alphaMin?: number;
  collideStrength?: number;
  radius?: number;
  startRadius?: number;
  endRadius?: number;
  clockwise?: boolean;
  unitRadius?: number;
  rankdir?: string;
  align?: string;
  nodesep?: number;
  ranksep?: number;
}

export const G6_PERFORMANCE_CONFIG = {
  MAX_NODES_WARNING: 500,
  MAX_NODES_DISPLAY: 1000,
  LAYOUT_ITERATIONS: 300,
  BATCH_UPDATE_THRESHOLD: 50,
  ANIMATION_DURATION: 500,
  DEBOUNCE_DELAY: 100,
} as const;

// Runtime validation for layout type
export function validateLayoutType(type: string): type is G6LayoutConfig['type'] {
  return ['force', 'circular', 'radial', 'dagre'].includes(type);
}

export const getLayoutConfig = (type: G6LayoutConfig['type']): G6LayoutConfig => {
  const baseConfig = {
    workerEnabled: true,
    preventOverlap: true,
    nodeSize: 25,
    maxIteration: G6_PERFORMANCE_CONFIG.LAYOUT_ITERATIONS,
  };

  switch (type) {
    case 'force':
      return {
        ...baseConfig,
        type: 'force',
        gravity: 10,
        linkDistance: 150,
        nodeStrength: -30,
        edgeStrength: 0.8,
        alphaDecay: 0.01,
        alphaMin: 0.001,
        collideStrength: 0.8,
      };
    case 'circular':
      return {
        ...baseConfig,
        type: 'circular',
        radius: 200,
        startRadius: 10,
        endRadius: 300,
        clockwise: true,
      };
    case 'radial':
      return {
        ...baseConfig,
        type: 'radial',
        unitRadius: 100,
        linkDistance: 100,
        nodeStrength: -30,
      };
    case 'dagre':
      return {
        ...baseConfig,
        type: 'dagre',
        rankdir: 'TB',
        align: 'DL',
        nodesep: 20,
        ranksep: 50,
      };
    default:
      console.warn(`Unknown layout type: ${type}, falling back to force`);
      return { ...baseConfig, type: 'force' };
  }
};

// Dynamic performance settings based on node count
export const getDynamicPerformanceConfig = (nodeCount: number) => {
  if (nodeCount > G6_PERFORMANCE_CONFIG.MAX_NODES_WARNING) {
    return {
      ...G6_PERFORMANCE_CONFIG,
      LAYOUT_ITERATIONS: Math.max(100, 300 - (nodeCount - 500) / 10),
      ANIMATION_DURATION: 200,
    };
  }
  return G6_PERFORMANCE_CONFIG;
};

export const NODE_STYLES = {
  default: {
    size: 25,
    lineWidth: 2,
    labelFontSize: 11,
    labelPosition: 'bottom' as const,
  },
  selected: {
    size: 30,
    lineWidth: 4,
    shadowBlur: 10,
    shadowColor: '#1890ff',
  },
  hover: {
    size: 28,
    lineWidth: 3,
  },
  'relation-source': {
    size: 32,
    lineWidth: 4,
    shadowBlur: 15,
  },
} as const;

export const EDGE_STYLES = {
  default: {
    lineWidth: 1.5,
    endArrow: {
      path: 'M 0,0 L 8,4 L 8,-4 Z',
      fill: '#91d5ff',
    },
    labelFontSize: 10,
  },
  hover: {
    lineWidth: 3,
    shadowBlur: 5,
    shadowColor: '#91d5ff',
  },
  selected: {
    lineWidth: 2.5,
    shadowBlur: 8,
    shadowColor: '#1890ff',
  },
} as const;

// G6 state configuration
export const G6_STATES = {
  node: {
    selected: {
      lineWidth: 4,
      shadowBlur: 10,
      shadowColor: '#1890ff',
    },
    hover: {
      lineWidth: 3,
    },
    inactive: {
      opacity: 0.5,
    },
  },
  edge: {
    selected: {
      lineWidth: 2.5,
      shadowBlur: 8,
      shadowColor: '#1890ff',
    },
    hover: {
      lineWidth: 3,
      shadowBlur: 5,
      shadowColor: '#91d5ff',
    },
    inactive: {
      opacity: 0.3,
    },
  },
} as const;

// G6 Behavior Configuration
export const G6_BEHAVIORS = {
  // Canvas behaviors
  'drag-canvas': {
    type: 'drag-canvas',
    enableOptimize: true,  // Enable performance optimization during dragging
    scalableRange: 0.1,    // Allow scaling range
  },
  'zoom-canvas': {
    type: 'zoom-canvas',
    enableOptimize: true,
    optimizeZoom: 0.02,    // Optimize zoom threshold
    maxZoom: 5,            // Maximum zoom level
    minZoom: 0.1,          // Minimum zoom level
    sensitivity: 1,        // Mouse wheel sensitivity
  },
  
  // Node behaviors
  'drag-node': {
    type: 'drag-node',
    enableDelegate: true,   // Show delegate shape while dragging
    delegateStyle: {
      fillOpacity: 0.8,
      fill: '#1890ff',
      stroke: '#1890ff',
    },
    updateEdge: true,      // Update connected edges during drag
    enableOptimize: true,  // Performance optimization
  },
  'click-select': {
    type: 'click-select',
    multiple: true,        // Allow multiple selection with Ctrl/Cmd
    trigger: 'shift',      // Use Shift key for multiple selection
  },
  'hover-activate': {
    type: 'hover-activate',
    activeState: 'hover',  // State name for hover
  },
  
  // Edge behaviors
  'create-edge': {
    type: 'create-edge',
    trigger: 'click',      // Click to create edge
    edgeConfig: {
      type: 'line',
      style: {
        stroke: '#1890ff',
        lineWidth: 2,
      },
    },
    shouldBegin: (e: any) => {
      // Only allow edge creation from nodes
      return e.item && e.item.getType() === 'node';
    },
  },
  
  // Brush select behavior
  'brush-select': {
    type: 'brush-select',
    brushStyle: {
      fill: '#EEF6FF',
      fillOpacity: 0.4,
      stroke: '#DDEEFE',
      lineWidth: 1,
    },
    onSelect: (nodes: any[]) => {
      console.log('Brush selected nodes:', nodes.length);
    },
    onDeselect: () => {
      console.log('Brush selection cleared');
    },
    selectedState: 'selected',
    includeEdges: false,   // Only select nodes, not edges
    trigger: 'shift',      // Use Shift+drag for brush select
  },
  
  // Lasso select behavior
  'lasso-select': {
    type: 'lasso-select',
    selectedState: 'selected',
    trigger: 'drag',
    delegateStyle: {
      fill: '#EEF6FF',
      fillOpacity: 0.4,
      stroke: '#DDEEFE',
      lineWidth: 1,
    },
  },
  
  // Shortcut keys behavior
  shortcuts: {
    type: 'shortcuts',
    shortcuts: {
      delete: ['Delete', 'Backspace'], // Delete selected items
      copy: ['ctrl+c', 'meta+c'],      // Copy selection
      paste: ['ctrl+v', 'meta+v'],     // Paste
      undo: ['ctrl+z', 'meta+z'],      // Undo
      redo: ['ctrl+y', 'meta+y', 'ctrl+shift+z', 'meta+shift+z'], // Redo
      selectAll: ['ctrl+a', 'meta+a'], // Select all
      zoomIn: ['ctrl+=', 'meta+='],    // Zoom in
      zoomOut: ['ctrl+-', 'meta+-'],   // Zoom out
      resetZoom: ['ctrl+0', 'meta+0'], // Reset zoom
      fitView: ['ctrl+1', 'meta+1'],   // Fit view
    },
  },
} as const;

// Default behavior modes for different interaction patterns
export const BEHAVIOR_MODES = {
  default: [
    'drag-canvas',
    'zoom-canvas', 
    'drag-node',
    'click-select',
    'hover-activate',
    'shortcuts',
  ],
  
  // Mode for creating connections between nodes
  connect: [
    'drag-canvas',
    'zoom-canvas',
    'create-edge',
    'click-select',
    'hover-activate',
    'shortcuts',
  ],
  
  // Mode for selecting multiple items
  select: [
    'drag-canvas',
    'zoom-canvas',
    'brush-select',
    'click-select',
    'hover-activate',
    'shortcuts',
  ],
  
  // Mode for editing (no canvas drag to prevent conflicts)
  edit: [
    'zoom-canvas',
    'drag-node',
    'click-select',
    'hover-activate',
    'shortcuts',
  ],
  
  // Read-only mode
  readonly: [
    'drag-canvas',
    'zoom-canvas',
    'hover-activate',
  ],
} as const;

// Get behavior configuration for a specific mode
export const getBehaviorConfig = (mode: keyof typeof BEHAVIOR_MODES = 'default') => {
  const behaviors = BEHAVIOR_MODES[mode] || BEHAVIOR_MODES.default;
  
  return behaviors.reduce((config, behaviorName) => {
    if (behaviorName in G6_BEHAVIORS) {
      config[behaviorName] = G6_BEHAVIORS[behaviorName as keyof typeof G6_BEHAVIORS];
    } else {
      // Simple behavior without config
      config[behaviorName] = behaviorName;
    }
    return config;
  }, {} as Record<string, any>);
};

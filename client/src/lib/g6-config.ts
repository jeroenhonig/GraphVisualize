
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
    preventOverlap: true,
    nodeSize: 25,
  };

  switch (type) {
    case 'force':
      return {
        ...baseConfig,
        type: 'force',
        center: [400, 300],
        gravity: 10,
        linkDistance: 150,
        nodeStrength: -300,
        edgeStrength: 0.6,
        alphaDecay: 0.028,
        alphaMin: 0.01,
        collideStrength: 0.8,
      };
    case 'circular':
      return {
        ...baseConfig,
        type: 'circular',
        center: [400, 300],
        radius: null,
        startRadius: 10,
        endRadius: 300,
        clockwise: true,
      };
    case 'radial':
      return {
        ...baseConfig,
        type: 'radial',
        center: [400, 300],
        unitRadius: 100,
        linkDistance: 100,
        nodeStrength: -300,
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

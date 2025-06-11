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
  BATCH_UPDATE_THRESHOLD: 50
} as const;

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
        linkDistance: 150,
        nodeStrength: -400,
        edgeStrength: 0.5,
        collideStrength: 1.5,
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
        nodeStrength: -500,
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
      return { ...baseConfig, type: 'force' };
  }
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
  },
  hover: {
    size: 28,
    lineWidth: 3,
  },
  'relation-source': {
    size: 32,
    lineWidth: 4,
    shadowBlur: 15,
  }
} as const;

export const EDGE_STYLES = {
  default: {
    lineWidth: 1.5,
    endArrow: true,
    labelFontSize: 10,
  },
  hover: {
    lineWidth: 3,
    shadowBlur: 5,
  }
} as const;
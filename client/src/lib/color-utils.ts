// Color system for node types
export interface NodeTypeColor {
  primary: string;
  secondary: string;
  hover: string;
  text: string;
}

// Predefined color palette for different node types
const TYPE_COLORS: Record<string, NodeTypeColor> = {
  // Building and Architecture
  building: {
    primary: '#2563eb', // Blue
    secondary: '#dbeafe',
    hover: '#1d4ed8',
    text: '#ffffff'
  },
  
  // Elements and Components
  element: {
    primary: '#dc2626', // Red
    secondary: '#fecaca',
    hover: '#b91c1c',
    text: '#ffffff'
  },
  
  // Materials
  material: {
    primary: '#059669', // Green
    secondary: '#d1fae5',
    hover: '#047857',
    text: '#ffffff'
  },
  
  // Documents and Information
  doc: {
    primary: '#7c3aed', // Purple
    secondary: '#e9d5ff',
    hover: '#6d28d9',
    text: '#ffffff'
  },
  document: {
    primary: '#7c3aed', // Purple
    secondary: '#e9d5ff',
    hover: '#6d28d9',
    text: '#ffffff'
  },
  
  // Properties and Attributes
  property: {
    primary: '#ea580c', // Orange
    secondary: '#fed7aa',
    hover: '#c2410c',
    text: '#ffffff'
  },
  
  // Relations and Connections
  relation: {
    primary: '#0891b2', // Cyan
    secondary: '#cffafe',
    hover: '#0e7490',
    text: '#ffffff'
  },
  
  // Spaces and Locations
  space: {
    primary: '#be185d', // Pink
    secondary: '#fce7f3',
    hover: '#9d174d',
    text: '#ffffff'
  },
  
  // Systems and Infrastructure
  system: {
    primary: '#4338ca', // Indigo
    secondary: '#e0e7ff',
    hover: '#3730a3',
    text: '#ffffff'
  },
  
  // Equipment and Tools
  equipment: {
    primary: '#b45309', // Amber
    secondary: '#fef3c7',
    hover: '#92400e',
    text: '#ffffff'
  },
  
  // Person and Entities
  person: {
    primary: '#374151', // Gray
    secondary: '#f3f4f6',
    hover: '#1f2937',
    text: '#ffffff'
  },
  entity: {
    primary: '#374151', // Gray
    secondary: '#f3f4f6',
    hover: '#1f2937',
    text: '#ffffff'
  }
};

// Default color for unknown types
const DEFAULT_COLOR: NodeTypeColor = {
  primary: '#6b7280', // Neutral gray
  secondary: '#f9fafb',
  hover: '#4b5563',
  text: '#ffffff'
};

/**
 * Get color scheme for a node type
 */
export function getNodeTypeColor(nodeType: string): NodeTypeColor {
  // Normalize the type string to lowercase for matching
  const normalizedType = nodeType.toLowerCase();
  
  // Try exact match first
  if (TYPE_COLORS[normalizedType]) {
    return TYPE_COLORS[normalizedType];
  }
  
  // Try partial matches for complex types
  for (const [type, colors] of Object.entries(TYPE_COLORS)) {
    if (normalizedType.includes(type) || type.includes(normalizedType)) {
      return colors;
    }
  }
  
  // Generate consistent color based on type string hash for unknown types
  return generateColorFromString(nodeType);
}

/**
 * Generate a consistent color scheme based on string hash
 */
function generateColorFromString(str: string): NodeTypeColor {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to HSL color
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 10); // 45-55%
  
  const primary = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const secondary = `hsl(${hue}, ${saturation}%, 90%)`;
  const hover = `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`;
  
  return {
    primary,
    secondary,
    hover,
    text: lightness < 50 ? '#ffffff' : '#000000'
  };
}

/**
 * Get all unique node types from nodes array
 */
export function getUniqueNodeTypes(nodes: Array<{ type: string }>): string[] {
  const types = new Set(nodes.map(node => node.type));
  return Array.from(types).sort();
}

/**
 * Generate a color legend for the current graph
 */
export function generateColorLegend(nodeTypes: string[]): Array<{ type: string; color: NodeTypeColor }> {
  return nodeTypes.map(type => ({
    type,
    color: getNodeTypeColor(type)
  }));
}

/**
 * Check if two node types should be grouped together (same base type)
 */
export function shouldGroupNodeTypes(type1: string, type2: string): boolean {
  const normalized1 = type1.toLowerCase();
  const normalized2 = type2.toLowerCase();
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Check if they share the same base type
  const baseTypes = ['building', 'element', 'material', 'doc', 'document', 'property', 'relation', 'space', 'system', 'equipment', 'person', 'entity'];
  
  for (const baseType of baseTypes) {
    if ((normalized1.includes(baseType) && normalized2.includes(baseType)) ||
        (baseType.includes(normalized1) && baseType.includes(normalized2))) {
      return true;
    }
  }
  
  return false;
}
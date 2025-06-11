// Color system for node types
export interface NodeTypeColor {
  primary: string;
  secondary: string;
  hover: string;
  text: string;
  // Legacy properties for backward compatibility
  color: string;
  bgColor: string;
}

// Predefined color palette for different node types
const TYPE_COLORS: Record<string, NodeTypeColor> = {
  // Building and Architecture
  building: {
    primary: '#2563eb', // Blue
    secondary: '#dbeafe',
    hover: '#1d4ed8',
    text: '#ffffff',
    color: '#2563eb',
    bgColor: '#dbeafe'
  },
  
  // Elements and Components
  element: {
    primary: '#dc2626', // Red
    secondary: '#fecaca',
    hover: '#b91c1c',
    text: '#ffffff',
    color: '#dc2626',
    bgColor: '#fecaca'
  },
  
  // Materials
  material: {
    primary: '#059669', // Green
    secondary: '#d1fae5',
    hover: '#047857',
    text: '#ffffff',
    color: '#059669',
    bgColor: '#d1fae5'
  },
  
  // Documents and Information
  doc: {
    primary: '#7c3aed', // Purple
    secondary: '#e9d5ff',
    hover: '#6d28d9',
    text: '#ffffff',
    color: '#7c3aed',
    bgColor: '#e9d5ff'
  },
  document: {
    primary: '#7c3aed', // Purple
    secondary: '#e9d5ff',
    hover: '#6d28d9',
    text: '#ffffff',
    color: '#7c3aed',
    bgColor: '#e9d5ff'
  },
  
  // Properties and Attributes
  property: {
    primary: '#ea580c', // Orange
    secondary: '#fed7aa',
    hover: '#c2410c',
    text: '#ffffff',
    color: '#ea580c',
    bgColor: '#fed7aa'
  },
  
  // Relations and Connections
  relation: {
    primary: '#0891b2', // Cyan
    secondary: '#cffafe',
    hover: '#0e7490',
    text: '#ffffff',
    color: '#0891b2',
    bgColor: '#cffafe'
  },
  
  // Spaces and Locations
  space: {
    primary: '#be185d', // Pink
    secondary: '#fce7f3',
    hover: '#9d174d',
    text: '#ffffff',
    color: '#be185d',
    bgColor: '#fce7f3'
  },
  
  // Systems and Infrastructure
  system: {
    primary: '#4338ca', // Indigo
    secondary: '#e0e7ff',
    hover: '#3730a3',
    text: '#ffffff',
    color: '#4338ca',
    bgColor: '#e0e7ff'
  },
  
  // Equipment and Tools
  equipment: {
    primary: '#b45309', // Amber
    secondary: '#fef3c7',
    hover: '#92400e',
    text: '#ffffff',
    color: '#b45309',
    bgColor: '#fef3c7'
  },
  
  // Person and Entities
  person: {
    primary: '#374151', // Gray
    secondary: '#f3f4f6',
    hover: '#1f2937',
    text: '#ffffff',
    color: '#374151',
    bgColor: '#f3f4f6'
  },
  entity: {
    primary: '#374151', // Gray
    secondary: '#f3f4f6',
    hover: '#1f2937',
    text: '#ffffff',
    color: '#374151',
    bgColor: '#f3f4f6'
  }
};

// Default color for unknown types
const DEFAULT_COLOR: NodeTypeColor = {
  primary: '#6b7280', // Neutral gray
  secondary: '#f9fafb',
  hover: '#4b5563',
  text: '#ffffff',
  color: '#6b7280',
  bgColor: '#f9fafb'
};

/**
 * Get color scheme for a node type
 */
export function getNodeTypeColor(nodeType: string): NodeTypeColor {
  // Check for custom colors first
  const customColors = getCustomColors();
  if (customColors[nodeType]) {
    return convertHexToNodeTypeColor(customColors[nodeType]);
  }

  // Normalize the type string to lowercase for matching
  const normalizedType = nodeType.toLowerCase();
  
  // Try exact match first
  if (TYPE_COLORS[normalizedType]) {
    return TYPE_COLORS[normalizedType];
  }
  
  // Try partial matches for complex types (check if the type contains any of our base types)
  for (const [type, colors] of Object.entries(TYPE_COLORS)) {
    if (normalizedType.includes(type)) {
      return colors;
    }
  }
  
  // Check for common prefixes/patterns in RDF/building data
  if (normalizedType.startsWith('element:') || normalizedType.includes('element')) {
    return TYPE_COLORS.element;
  }
  if (normalizedType.startsWith('material:') || normalizedType.includes('material')) {
    return TYPE_COLORS.material;
  }
  if (normalizedType.startsWith('building:') || normalizedType.includes('building')) {
    return TYPE_COLORS.building;
  }
  if (normalizedType.startsWith('doc:') || normalizedType.includes('document')) {
    return TYPE_COLORS.doc;
  }
  
  // Generate consistent color based on type string hash for completely unknown types
  return generateColorFromString(nodeType);
}

// Get custom colors from localStorage
function getCustomColors(): Record<string, string> {
  try {
    const saved = localStorage.getItem('nodeTypeColors');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Convert hex color to NodeTypeColor object
function convertHexToNodeTypeColor(hex: string): NodeTypeColor {
  return {
    primary: hex,
    secondary: hex + '20', // Add transparency
    hover: adjustBrightness(hex, -20),
    text: getContrastColor(hex)
  };
}

// Adjust color brightness
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Get contrasting text color
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

/**
 * Generate a consistent color scheme based on string hash
 */
function generateColorFromString(str: string): NodeTypeColor {
  // Enhanced hash function for better distribution
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use a more diverse set of predefined colors for better distinction
  const colorPalette = [
    { h: 0, s: 70, l: 50 },    // Red
    { h: 30, s: 70, l: 50 },   // Orange
    { h: 60, s: 70, l: 50 },   // Yellow
    { h: 120, s: 70, l: 45 },  // Green
    { h: 180, s: 70, l: 45 },  // Cyan
    { h: 240, s: 70, l: 50 },  // Blue
    { h: 270, s: 70, l: 50 },  // Purple
    { h: 300, s: 70, l: 50 },  // Magenta
    { h: 15, s: 80, l: 45 },   // Red-Orange
    { h: 45, s: 75, l: 48 },   // Amber
    { h: 75, s: 65, l: 48 },   // Lime
    { h: 165, s: 75, l: 42 },  // Teal
    { h: 195, s: 70, l: 48 },  // Sky Blue
    { h: 225, s: 75, l: 52 },  // Indigo
    { h: 285, s: 70, l: 48 },  // Violet
    { h: 330, s: 75, l: 48 },  // Pink
  ];
  
  // Select color based on hash
  const colorIndex = Math.abs(hash) % colorPalette.length;
  const selectedColor = colorPalette[colorIndex];
  
  // Add some variation based on the hash
  const hueVariation = (Math.abs(hash) % 20) - 10; // -10 to +10
  const satVariation = (Math.abs(hash) % 10) - 5;  // -5 to +5
  const lightVariation = (Math.abs(hash) % 8) - 4; // -4 to +4
  
  const finalHue = (selectedColor.h + hueVariation + 360) % 360;
  const finalSat = Math.max(50, Math.min(85, selectedColor.s + satVariation));
  const finalLight = Math.max(35, Math.min(60, selectedColor.l + lightVariation));
  
  const primary = `hsl(${finalHue}, ${finalSat}%, ${finalLight}%)`;
  const secondary = `hsl(${finalHue}, ${Math.max(30, finalSat - 20)}%, 90%)`;
  const hover = `hsl(${finalHue}, ${finalSat}%, ${Math.max(25, finalLight - 8)}%)`;
  
  return {
    primary,
    secondary,
    hover,
    text: finalLight < 50 ? '#ffffff' : '#000000'
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
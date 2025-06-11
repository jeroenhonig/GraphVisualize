import { getNodeTypeColor, getUniqueNodeTypes } from "@/lib/color-utils";
import type { VisualizationNode } from "@shared/schema";

interface ColorDebugProps {
  nodes: VisualizationNode[];
}

// Temporary debug component to show all colors
export default function ColorDebug({ nodes }: ColorDebugProps) {
  const nodeTypes = getUniqueNodeTypes(nodes);
  
  console.log("Node types and their colors:");
  nodeTypes.forEach(type => {
    const colors = getNodeTypeColor(type);
    console.log(`${type}: ${colors.primary}`);
  });

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-2">
      <h3 className="font-bold text-sm">Color Debug (console check)</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {nodeTypes.map(type => {
          const colors = getNodeTypeColor(type);
          return (
            <div key={type} className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: colors.primary }}
              />
              <span className="truncate">{type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
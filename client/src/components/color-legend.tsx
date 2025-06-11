import { useState, useEffect } from "react";
import { getUniqueNodeTypes, generateColorLegend } from "@/lib/color-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette, Save, RotateCcw } from "lucide-react";
import type { VisualizationNode } from "@shared/schema";

interface ColorLegendProps {
  nodes: VisualizationNode[];
}

export default function ColorLegend({ nodes }: ColorLegendProps) {
  const nodeTypes = getUniqueNodeTypes(nodes);
  const colorLegend = generateColorLegend(nodeTypes);

  if (nodeTypes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Type Kleuren
      </h4>
      <div className="space-y-1">
        {colorLegend.map(({ type, color }) => (
          <div 
            key={type} 
            className="flex items-center space-x-2 text-xs"
          >
            <div 
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: color.primary }}
            />
            <span className="text-gray-600 dark:text-gray-400 capitalize">
              {type}
            </span>
            <span className="text-gray-400 dark:text-gray-500">
              ({nodes.filter(n => n.type === type).length})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
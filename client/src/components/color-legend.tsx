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
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [tempColors, setTempColors] = useState<Record<string, string>>({});

  // Load custom colors from localStorage on mount
  useEffect(() => {
    const savedColors = localStorage.getItem('nodeTypeColors');
    if (savedColors) {
      try {
        setCustomColors(JSON.parse(savedColors));
      } catch (error) {
        console.error('Error loading saved colors:', error);
      }
    }
  }, []);

  // Save colors to localStorage when customColors change
  useEffect(() => {
    if (Object.keys(customColors).length > 0) {
      localStorage.setItem('nodeTypeColors', JSON.stringify(customColors));
    }
  }, [customColors]);

  const startCustomizing = () => {
    setTempColors({ ...customColors });
    setIsCustomizing(true);
  };

  const saveColors = () => {
    setCustomColors({ ...tempColors });
    setIsCustomizing(false);
  };

  const cancelCustomizing = () => {
    setTempColors({});
    setIsCustomizing(false);
  };

  const resetColors = () => {
    setCustomColors({});
    setTempColors({});
    localStorage.removeItem('nodeTypeColors');
    setIsCustomizing(false);
  };

  const updateTempColor = (type: string, color: string) => {
    setTempColors(prev => ({ ...prev, [type]: color }));
  };

  const getEffectiveColor = (type: string, originalColor: string) => {
    if (isCustomizing) {
      return tempColors[type] || customColors[type] || originalColor;
    }
    return customColors[type] || originalColor;
  };

  if (nodeTypes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Type Kleuren
        </h4>
        {!isCustomizing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={startCustomizing}
            className="h-6 w-6 p-0"
            title="Kleuren aanpassen"
          >
            <Palette className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={saveColors}
              className="h-6 w-6 p-0"
              title="Opslaan"
            >
              <Save className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetColors}
              className="h-6 w-6 p-0"
              title="Reset naar standaard"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelCustomizing}
              className="h-6 w-6 p-0"
              title="Annuleren"
            >
              ×
            </Button>
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        {colorLegend.map(({ type, color }) => {
          const effectiveColor = getEffectiveColor(type, color.primary);
          return (
            <div 
              key={type} 
              className="flex items-center space-x-2 text-xs"
            >
              {isCustomizing ? (
                <Input
                  type="color"
                  value={effectiveColor}
                  onChange={(e) => updateTempColor(type, e.target.value)}
                  className="w-6 h-6 p-0 border-0 rounded-full cursor-pointer"
                  title={`Kleur voor ${type}`}
                />
              ) : (
                <div 
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: effectiveColor }}
                />
              )}
              <span className="text-gray-600 dark:text-gray-400 capitalize flex-1">
                {type}
              </span>
              <span className="text-gray-400 dark:text-gray-500">
                ({nodes.filter(n => n.type === type).length})
              </span>
            </div>
          );
        })}
      </div>
      
      {isCustomizing && (
        <div className="flex space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={saveColors}
            size="sm"
            className="flex-1"
          >
            <Save className="h-3 w-3 mr-1" />
            Opslaan
          </Button>
          <Button
            onClick={cancelCustomizing}
            variant="outline"
            size="sm"
          >
            Annuleren
          </Button>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from "react";

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutPreferences {
  currentLayout: 1 | 2 | 3; // Layout configuration number
  collapsed: {
    navigation: boolean;
    details: boolean;
  };
}

// Define the three layout configurations - only navigation and details panels
export const LAYOUT_POSITIONS = {
  1: {
    // Navigatie links, details rechts
    navigation: { x: 20, y: 100, width: 320, height: 'calc(100vh - 140px)' },
    details: { x: 'right', y: 100, width: 320, height: 'calc(100vh - 140px)' }
  },
  2: {
    // Navigatie links boven, details links onder
    navigation: { x: 20, y: 100, width: 320, height: 'calc(50vh - 90px)' },
    details: { x: 20, y: 'bottom-half', width: 320, height: 'calc(50vh - 90px)' }
  },
  3: {
    // Navigatie rechts boven, details rechts onder
    navigation: { x: 'right', y: 100, width: 320, height: 'calc(50vh - 90px)' },
    details: { x: 'right', y: 'bottom-half', width: 320, height: 'calc(50vh - 90px)' }
  }
} as const;

const DEFAULT_PREFERENCES: LayoutPreferences = {
  currentLayout: 1,
  collapsed: {
    navigation: false,
    details: false,
  },
};

export function useLayoutPreferences() {
  const [preferences, setPreferences] = useState<LayoutPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('graph-layout-preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.warn('Failed to parse layout preferences:', error);
      }
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('graph-layout-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (updates: Partial<LayoutPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const rotateLayout = () => {
    const nextLayout = (preferences.currentLayout % 3) + 1 as 1 | 2 | 3;
    updatePreferences({ currentLayout: nextLayout });
  };

  const togglePanelCollapse = (panel: 'navigation' | 'details') => {
    updatePreferences({ 
      collapsed: { 
        ...preferences.collapsed, 
        [panel]: !preferences.collapsed[panel] 
      } 
    });
  };

  const getCurrentPositions = () => {
    if (typeof window === 'undefined') {
      return LAYOUT_POSITIONS[1]; // Default for SSR
    }
    return LAYOUT_POSITIONS[preferences.currentLayout];
  };

  return {
    preferences,
    updatePreferences,
    rotateLayout,
    togglePanelCollapse,
    getCurrentPositions,
  };
}
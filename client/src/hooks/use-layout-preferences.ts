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
    view: boolean;
  };
}

// Define the three layout configurations
export const LAYOUT_POSITIONS = {
  1: {
    navigation: { x: 20, y: 100, width: 320, height: 'calc(100vh - 140px)' },
    view: { x: 'calc(50% - 160px)', y: 100, width: 320, height: 'calc(100vh - 140px)' },
    details: { x: 'calc(100% - 340px)', y: 100, width: 320, height: 'calc(100vh - 140px)' }
  },
  2: {
    navigation: { x: 20, y: 100, width: 320, height: 'calc(50vh - 90px)' },
    details: { x: 20, y: 'calc(50vh + 10px)', width: 320, height: 'calc(50vh - 90px)' },
    view: { x: 'calc(100% - 340px)', y: 100, width: 320, height: 'calc(100vh - 140px)' }
  },
  3: {
    view: { x: 20, y: 100, width: 320, height: 'calc(100vh - 140px)' },
    navigation: { x: 'calc(100% - 340px)', y: 100, width: 320, height: 'calc(50vh - 90px)' },
    details: { x: 'calc(100% - 340px)', y: 'calc(50vh + 10px)', width: 320, height: 'calc(50vh - 90px)' }
  }
} as const;

const DEFAULT_PREFERENCES: LayoutPreferences = {
  currentLayout: 1,
  collapsed: {
    navigation: false,
    details: false,
    view: false,
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

  const togglePanelCollapse = (panel: 'navigation' | 'details' | 'view') => {
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
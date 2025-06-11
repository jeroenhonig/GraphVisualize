import { useState, useEffect } from "react";

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutPreferences {
  currentLayout: 1 | 2; // Layout configuration number (only 2 layouts now)
  collapsed: {
    navigation: boolean;
    view: boolean;
  };
}

// Define the two layout configurations - navigation and view panels only
export const LAYOUT_POSITIONS = {
  1: {
    // Navigatie links, view rechts - volledige schermbenutting
    navigation: { x: 0, y: 80, width: 320, height: 'calc(100vh - 80px)' },
    view: { x: 320, y: 80, width: 'calc(100vw - 320px)', height: 'calc(100vh - 80px)' }
  },
  2: {
    // View links, navigatie rechts - volledige schermbenutting
    view: { x: 0, y: 80, width: 'calc(100vw - 320px)', height: 'calc(100vh - 80px)' },
    navigation: { x: 'calc(100vw - 320px)', y: 80, width: 320, height: 'calc(100vh - 80px)' }
  }
} as const;

const DEFAULT_PREFERENCES: LayoutPreferences = {
  currentLayout: 1,
  collapsed: {
    navigation: false,
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
        // Force navigation panel to be expanded for proper container mounting
        setPreferences({ 
          ...DEFAULT_PREFERENCES, 
          ...parsed,
          collapsed: {
            ...parsed.collapsed,
            navigation: false  // Always expand navigation for proper GraphCanvas mounting
          }
        });
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
    const nextLayout = (preferences.currentLayout % 2) + 1 as 1 | 2;
    updatePreferences({ currentLayout: nextLayout });
  };

  const togglePanelCollapse = (panel: 'navigation' | 'view') => {
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
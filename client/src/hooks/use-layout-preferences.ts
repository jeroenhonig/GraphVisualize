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

// Define the three layout configurations - navigation, details, and view panels
export const LAYOUT_POSITIONS = {
  1: {
    // Navigatie links, view midden, details rechts - volledige schermbenutting
    navigation: { x: 0, y: 80, width: 320, height: 'calc(100vh - 80px)' },
    view: { x: 320, y: 80, width: 'calc(100vw - 640px)', height: 'calc(100vh - 80px)' },
    details: { x: 'calc(100vw - 320px)', y: 80, width: 320, height: 'calc(100vh - 80px)' }
  },
  2: {
    // Navigatie links boven, details links onder, view rechts - volledige schermbenutting
    navigation: { x: 0, y: 80, width: 320, height: 'calc(50vh - 40px)' },
    details: { x: 0, y: 'calc(50vh + 40px)', width: 320, height: 'calc(50vh - 40px)' },
    view: { x: 320, y: 80, width: 'calc(100vw - 320px)', height: 'calc(100vh - 80px)' }
  },
  3: {
    // View links, navigatie rechts boven, details rechts onder - volledige schermbenutting
    view: { x: 0, y: 80, width: 'calc(100vw - 320px)', height: 'calc(100vh - 80px)' },
    navigation: { x: 'calc(100vw - 320px)', y: 80, width: 320, height: 'calc(50vh - 40px)' },
    details: { x: 'calc(100vw - 320px)', y: 'calc(50vh + 40px)', width: 320, height: 'calc(50vh - 40px)' }
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
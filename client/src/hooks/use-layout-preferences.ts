import { useState, useEffect } from "react";

export interface LayoutPreferences {
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  leftSidebarPosition: { x: number; y: number };
  rightSidebarPosition: { x: number; y: number };
  leftSidebarWidth: number;
  rightSidebarWidth: number;
}

const DEFAULT_PREFERENCES: LayoutPreferences = {
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  leftSidebarPosition: { x: 0, y: 80 }, // Below header
  rightSidebarPosition: { x: 0, y: 80 }, // Will be calculated based on window width
  leftSidebarWidth: 320,
  rightSidebarWidth: 320,
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

  const toggleLeftSidebar = () => {
    updatePreferences({ leftSidebarCollapsed: !preferences.leftSidebarCollapsed });
  };

  const toggleRightSidebar = () => {
    updatePreferences({ rightSidebarCollapsed: !preferences.rightSidebarCollapsed });
  };

  const updateLeftPosition = (position: { x: number; y: number }) => {
    updatePreferences({ leftSidebarPosition: position });
  };

  const updateRightPosition = (position: { x: number; y: number }) => {
    updatePreferences({ rightSidebarPosition: position });
  };

  const updateLeftWidth = (width: number) => {
    updatePreferences({ leftSidebarWidth: Math.max(200, Math.min(600, width)) });
  };

  const updateRightWidth = (width: number) => {
    updatePreferences({ rightSidebarWidth: Math.max(200, Math.min(600, width)) });
  };

  const resetToDefault = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    updatePreferences,
    toggleLeftSidebar,
    toggleRightSidebar,
    updateLeftPosition,
    updateRightPosition,
    updateLeftWidth,
    updateRightWidth,
    resetToDefault,
  };
}
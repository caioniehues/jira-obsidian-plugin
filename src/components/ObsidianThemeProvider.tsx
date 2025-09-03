import React, { useEffect, useState } from 'react';

interface ObsidianThemeProviderProps {
  children: React.ReactNode;
}

export const ObsidianThemeProvider: React.FC<ObsidianThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check Obsidian's current theme
    const checkTheme = () => {
      const body = document.body;
      const isDark = body.classList.contains('theme-dark');
      setIsDarkMode(isDark);
    };

    // Initial check
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`obsidian-theme-provider ${isDarkMode ? 'dark' : 'light'}`}>
      {children}
    </div>
  );
};
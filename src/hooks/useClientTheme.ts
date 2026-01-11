import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function useClientTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Evita hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return {
    theme,
    setTheme,
    systemTheme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    mounted,
  };
}

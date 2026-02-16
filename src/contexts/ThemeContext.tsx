import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeName = "midnight-gold" | "ocean-teal" | "royal-purple" | "forest-emerald" | "sunset-coral";

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: { name: ThemeName; label: string; preview: string }[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};

const themeVars: Record<ThemeName, Record<string, string>> = {
  "midnight-gold": {
    "--background": "220 40% 6%",
    "--foreground": "40 20% 95%",
    "--card": "220 35% 10%",
    "--card-foreground": "40 20% 95%",
    "--popover": "220 35% 10%",
    "--popover-foreground": "40 20% 95%",
    "--primary": "43 70% 53%",
    "--primary-foreground": "220 40% 6%",
    "--secondary": "220 35% 16%",
    "--secondary-foreground": "40 20% 90%",
    "--muted": "220 25% 14%",
    "--muted-foreground": "220 15% 55%",
    "--accent": "215 60% 35%",
    "--accent-foreground": "40 20% 95%",
    "--border": "220 25% 18%",
    "--input": "220 25% 18%",
    "--ring": "43 70% 53%",
    "--gold": "43 70% 53%",
    "--gold-light": "43 80% 65%",
    "--gold-dark": "43 60% 40%",
    "--sidebar-background": "220 40% 8%",
    "--sidebar-foreground": "40 20% 85%",
    "--sidebar-primary": "43 70% 53%",
    "--sidebar-border": "220 25% 16%",
    "--glass-bg": "220 35% 12%",
    "--glass-border": "220 25% 22%",
  },
  "ocean-teal": {
    "--background": "200 40% 6%",
    "--foreground": "180 20% 95%",
    "--card": "200 35% 10%",
    "--card-foreground": "180 20% 95%",
    "--popover": "200 35% 10%",
    "--popover-foreground": "180 20% 95%",
    "--primary": "174 70% 45%",
    "--primary-foreground": "200 40% 6%",
    "--secondary": "200 35% 16%",
    "--secondary-foreground": "180 20% 90%",
    "--muted": "200 25% 14%",
    "--muted-foreground": "200 15% 55%",
    "--accent": "190 60% 35%",
    "--accent-foreground": "180 20% 95%",
    "--border": "200 25% 18%",
    "--input": "200 25% 18%",
    "--ring": "174 70% 45%",
    "--gold": "174 70% 45%",
    "--gold-light": "174 80% 60%",
    "--gold-dark": "174 60% 35%",
    "--sidebar-background": "200 40% 8%",
    "--sidebar-foreground": "180 20% 85%",
    "--sidebar-primary": "174 70% 45%",
    "--sidebar-border": "200 25% 16%",
    "--glass-bg": "200 35% 12%",
    "--glass-border": "200 25% 22%",
  },
  "royal-purple": {
    "--background": "270 40% 6%",
    "--foreground": "280 20% 95%",
    "--card": "270 35% 10%",
    "--card-foreground": "280 20% 95%",
    "--popover": "270 35% 10%",
    "--popover-foreground": "280 20% 95%",
    "--primary": "280 70% 60%",
    "--primary-foreground": "270 40% 6%",
    "--secondary": "270 35% 16%",
    "--secondary-foreground": "280 20% 90%",
    "--muted": "270 25% 14%",
    "--muted-foreground": "270 15% 55%",
    "--accent": "290 60% 40%",
    "--accent-foreground": "280 20% 95%",
    "--border": "270 25% 18%",
    "--input": "270 25% 18%",
    "--ring": "280 70% 60%",
    "--gold": "280 70% 60%",
    "--gold-light": "280 80% 72%",
    "--gold-dark": "280 60% 45%",
    "--sidebar-background": "270 40% 8%",
    "--sidebar-foreground": "280 20% 85%",
    "--sidebar-primary": "280 70% 60%",
    "--sidebar-border": "270 25% 16%",
    "--glass-bg": "270 35% 12%",
    "--glass-border": "270 25% 22%",
  },
  "forest-emerald": {
    "--background": "150 40% 5%",
    "--foreground": "140 20% 95%",
    "--card": "150 35% 9%",
    "--card-foreground": "140 20% 95%",
    "--popover": "150 35% 9%",
    "--popover-foreground": "140 20% 95%",
    "--primary": "142 60% 45%",
    "--primary-foreground": "150 40% 5%",
    "--secondary": "150 35% 15%",
    "--secondary-foreground": "140 20% 90%",
    "--muted": "150 25% 13%",
    "--muted-foreground": "150 15% 50%",
    "--accent": "155 55% 32%",
    "--accent-foreground": "140 20% 95%",
    "--border": "150 25% 17%",
    "--input": "150 25% 17%",
    "--ring": "142 60% 45%",
    "--gold": "142 60% 45%",
    "--gold-light": "142 70% 58%",
    "--gold-dark": "142 50% 35%",
    "--sidebar-background": "150 40% 7%",
    "--sidebar-foreground": "140 20% 85%",
    "--sidebar-primary": "142 60% 45%",
    "--sidebar-border": "150 25% 15%",
    "--glass-bg": "150 35% 11%",
    "--glass-border": "150 25% 20%",
  },
  "sunset-coral": {
    "--background": "15 40% 6%",
    "--foreground": "20 20% 95%",
    "--card": "15 35% 10%",
    "--card-foreground": "20 20% 95%",
    "--popover": "15 35% 10%",
    "--popover-foreground": "20 20% 95%",
    "--primary": "12 80% 55%",
    "--primary-foreground": "15 40% 6%",
    "--secondary": "15 35% 16%",
    "--secondary-foreground": "20 20% 90%",
    "--muted": "15 25% 14%",
    "--muted-foreground": "15 15% 50%",
    "--accent": "25 70% 40%",
    "--accent-foreground": "20 20% 95%",
    "--border": "15 25% 18%",
    "--input": "15 25% 18%",
    "--ring": "12 80% 55%",
    "--gold": "12 80% 55%",
    "--gold-light": "12 85% 67%",
    "--gold-dark": "12 70% 42%",
    "--sidebar-background": "15 40% 8%",
    "--sidebar-foreground": "20 20% 85%",
    "--sidebar-primary": "12 80% 55%",
    "--sidebar-border": "15 25% 16%",
    "--glass-bg": "15 35% 12%",
    "--glass-border": "15 25% 22%",
  },
};

const themes: { name: ThemeName; label: string; preview: string }[] = [
  { name: "midnight-gold", label: "Midnight Gold", preview: "hsl(43, 70%, 53%)" },
  { name: "ocean-teal", label: "Ocean Teal", preview: "hsl(174, 70%, 45%)" },
  { name: "royal-purple", label: "Royal Purple", preview: "hsl(280, 70%, 60%)" },
  { name: "forest-emerald", label: "Forest Emerald", preview: "hsl(142, 60%, 45%)" },
  { name: "sunset-coral", label: "Sunset Coral", preview: "hsl(12, 80%, 55%)" },
];

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem("app-theme") as ThemeName) || "midnight-gold";
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem("app-theme", t);
  };

  useEffect(() => {
    const vars = themeVars[theme];
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

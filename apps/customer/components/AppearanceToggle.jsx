"use client";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "../../../marketing/components/ThemeProvider";

export default function AppearanceToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="appearance" role="group" aria-label="Color appearance">
      {[
        ["light", "Light", Sun],
        ["dark", "Dark", Moon],
        ["system", "System", Monitor],
      ].map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} appearance`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          title={`${label} appearance`}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

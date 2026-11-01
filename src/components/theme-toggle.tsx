"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme
      ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("studyflow-theme", nextTheme);
  }

  return (
    <button
      aria-label="Alternar tema claro ou escuro"
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span className="theme-icon-light"><Moon aria-hidden="true" size={16} /></span>
      <span className="theme-icon-dark"><Sun aria-hidden="true" size={17} /></span>
    </button>
  );
}

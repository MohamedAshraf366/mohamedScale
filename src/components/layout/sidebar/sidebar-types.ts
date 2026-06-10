import type React from "react";

export type ModuleKey = "sales" | "supply" | "operations" | "admin";

export interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  icon: React.ElementType;
  /** Tailwind class tokens (should rely on semantic tokens and opacity) */
  activeClassName: string;
  items: NavItem[];
}

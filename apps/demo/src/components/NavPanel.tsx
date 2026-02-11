import { useState } from "react";
import type { NavCategory } from "../config/nav";

export interface NavPanelProps {
  categories: NavCategory[];
  activeDemo: string;
  onNavigate: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.427 5.427a.75.75 0 011.146 0L8 7.854l2.427-2.427a.75.75 0 111.146 1.146l-3 3a.75.75 0 01-1.146 0l-3-3a.75.75 0 010-1.146z" />
  </svg>
);

export function NavPanel({
  categories,
  activeDemo,
  onNavigate,
  isOpen,
  onClose,
}: NavPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.label)),
  );

  const toggleCategory = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside className={`nav-panel${isOpen ? " nav-panel--open" : ""}`}>
      <button type="button" className="nav-close" onClick={onClose}>
        ✕
      </button>

      <div className="nav-header">
        <h1>AnyTable <span className="alpha-tag">alpha</span></h1>
        <p>Demo Gallery</p>
      </div>

      {categories.map((cat) => {
        const isExpanded = expanded.has(cat.label);
        return (
          <div key={cat.label} className="nav-category">
            <button
              type="button"
              className="nav-category-toggle"
              aria-expanded={isExpanded}
              onClick={() => toggleCategory(cat.label)}
            >
              {cat.label}
              <ChevronDown />
            </button>

            {isExpanded && (
              <div className="nav-category-items">
                {cat.items.map((item) => {
                  const isActive = item.id === activeDemo;
                  const cls = [
                    "nav-item",
                    isActive && "nav-item--active",
                    !item.enabled && "nav-item--disabled",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cls}
                      onClick={() => {
                        if (item.enabled) {
                          onNavigate(item.id);
                          onClose();
                        }
                      }}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

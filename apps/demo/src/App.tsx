import { useEffect, useMemo, useRef, useState } from "react";
import { DemoLoader } from "./components/DemoLoader";
import { NavPanel } from "./components/NavPanel";
import { categories, DEFAULT_DEMO_ID, findNavItem } from "./config/nav";
import { DatasetLoadingProvider } from "./context/DatasetLoadingContext";
import { CrossFilterDemo } from "./demos/CrossFilterDemo";
import { CustomCellsDemo } from "./demos/CustomCellsDemo";
import { DeclarativeCellsDemo } from "./demos/DeclarativeCellsDemo";
import { DeclarativeDemo } from "./demos/DeclarativeDemo";
import { DeclarativeValidationDemo } from "./demos/DeclarativeValidationDemo";
import { LocalFileDemo } from "./demos/LocalFileDemo";
import { PlanetsComparisonDemo } from "./demos/PlanetsComparisonDemo";
import { RubricsDemo } from "./demos/RubricsDemo";
import { SearchDemo } from "./demos/SearchDemo";
import { TracesDemo } from "./demos/TracesDemo";
import { useQueryParam } from "./hooks/useQueryParam";
import { initDuckDB, type DuckDBHandle } from "./setup-mosaic";

export default function App() {
  const didInit = useRef(false);
  const [handle, setHandle] = useState<DuckDBHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useQueryParam("demo", DEFAULT_DEMO_ID);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    initDuckDB()
      .then((h) => setHandle(h))
      .catch((err) => {
        console.error(err);
        setError(String(err));
      });
  }, []);

  const navItem = useMemo(() => {
    const item = findNavItem(activeDemo);
    return item?.enabled ? item : undefined;
  }, [activeDemo]);

  useEffect(() => {
    if (!navItem) setActiveDemo(DEFAULT_DEMO_ID);
  }, [navItem, setActiveDemo]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>
        <h1>Error</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  const active = navItem ?? findNavItem(DEFAULT_DEMO_ID)!;
  const DemoComponent =
    active.id === "swe-bench-traces"
      ? TracesDemo
      : active.id === "custom-cells"
        ? CustomCellsDemo
        : active.id === "search"
          ? SearchDemo
          : active.id === "cross-filtering"
            ? CrossFilterDemo
            : active.id === "declarative-spec"
              ? DeclarativeDemo
              : active.id === "declarative-cells"
                ? DeclarativeCellsDemo
                : active.id === "declarative-validation"
                  ? DeclarativeValidationDemo
                  : active.id === "planets-comparison"
                    ? PlanetsComparisonDemo
                    : active.id === "local-file"
                      ? LocalFileDemo
                      : RubricsDemo;

  return (
    <DatasetLoadingProvider handle={handle}>
        <div className="mobile-header">
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="mobile-title">AnyTable <span className="alpha-tag">alpha</span></span>
        </div>

        <div
          className={`nav-overlay${sidebarOpen ? " nav-overlay--visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <div className="app-layout">
          <NavPanel
            categories={categories}
            activeDemo={active.id}
            onNavigate={setActiveDemo}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main className="app-main">
            <h1>{active.title}</h1>
            <p className="subtitle">{active.description}</p>
            <DemoLoader demo={active}>
              <DemoComponent />
            </DemoLoader>
          </main>
        </div>
      </DatasetLoadingProvider>
  );
}

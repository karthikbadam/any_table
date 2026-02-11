import type { Coordinator } from "@any_table/react";
import { MosaicProvider } from "@any_table/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavPanel } from "./components/NavPanel";
import { categories, DEFAULT_DEMO_ID, findNavItem } from "./config/nav";
import { RubricsDemo } from "./demos/RubricsDemo";
import { TracesDemo } from "./demos/TracesDemo";
import { useQueryParam } from "./hooks/useQueryParam";
import { setupMosaic } from "./setup-mosaic";

export default function App() {
  const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coordinatorRef = useRef<Coordinator | null>(null);
  const [activeDemo, setActiveDemo] = useQueryParam("demo", DEFAULT_DEMO_ID);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (setup) return;
    setSetup(true);
    setupMosaic()
      .then((coord) => {
        coordinatorRef.current = coord;
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        setError(String(err));
      });
  }, [setup]);

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

  if (!ready) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
          AnyTable Demo
        </h1>
        <p>Loading datasets into DuckDB-WASM...</p>
      </div>
    );
  }

  const active = navItem ?? findNavItem(DEFAULT_DEMO_ID)!;
  const DemoComponent =
    active.id === "swe-bench-traces" ? TracesDemo : RubricsDemo;

  return (
    <MosaicProvider coordinator={coordinatorRef.current}>
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
          <DemoComponent />
        </main>
      </div>
    </MosaicProvider>
  );
}

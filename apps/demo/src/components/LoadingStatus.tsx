import type { CSSProperties } from "react";

export type LoadingStepState = "pending" | "active" | "done";

export interface LoadingStep {
  id: string;
  label: string;
  state: LoadingStepState;
  detail?: string;
}

export interface LoadingStatusProps {
  title: string;
  steps: LoadingStep[];
}

const iconBoxStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const PendingIcon = () => (
  <span
    style={{
      ...iconBoxStyle,
      border: "1px solid var(--border-strong)",
      background: "var(--surface-2)",
    }}
    aria-label="pending"
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        border: "1.5px solid var(--muted-fg)",
        opacity: 0.7,
      }}
    />
  </span>
);

const ActiveIcon = () => (
  <span
    style={{
      ...iconBoxStyle,
      border: "1px solid var(--border-strong)",
      background: "var(--surface-2)",
    }}
    aria-label="loading"
  >
    <span className="loading-status-spinner" />
  </span>
);

const DoneIcon = () => (
  <span
    style={{
      ...iconBoxStyle,
      background: "var(--good-bg)",
      border: "1px solid var(--good-fg)",
      color: "var(--good-fg)",
    }}
    aria-label="done"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

function StepIcon({ state }: { state: LoadingStepState }) {
  if (state === "done") return <DoneIcon />;
  if (state === "active") return <ActiveIcon />;
  return <PendingIcon />;
}

export function LoadingStatus({ title, steps }: LoadingStatusProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "2rem",
        maxWidth: 520,
      }}
    >
      <h2
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          color: "var(--fg)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {steps.map((step) => {
          const isActive = step.state === "active";
          const isPending = step.state === "pending";
          return (
            <li
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: "0.95rem",
                color: isPending ? "var(--muted-fg)" : "var(--fg)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <StepIcon state={step.state} />
              <span>{step.label}</span>
              {step.detail && isActive && (
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  ({step.detail})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

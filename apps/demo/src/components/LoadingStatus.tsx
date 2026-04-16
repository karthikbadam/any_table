import type { CSSProperties } from "react";

export type LoadingStepState = "pending" | "active" | "done";

export interface LoadingStep {
  id: string;
  label: string;
  state: LoadingStepState;
  detail?: string;
}

export interface LoadingStatusProps {
  steps: LoadingStep[];
}

const iconSize: CSSProperties = {
  width: 16,
  height: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const PendingIcon = () => (
  <span style={iconSize} aria-label="pending">
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        border: "1.5px solid var(--muted-fg)",
        opacity: 0.5,
      }}
    />
  </span>
);

const ActiveIcon = () => (
  <span style={iconSize} aria-label="loading">
    <span className="loading-status-spinner" />
  </span>
);

const DoneIcon = () => (
  <span
    style={{ ...iconSize, color: "var(--good-fg)" }}
    aria-label="done"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 7.2L5.6 9.8L11 4.2"
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

export function LoadingStatus({ steps }: LoadingStatusProps) {
  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
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
              gap: 10,
              fontSize: "0.875rem",
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
                }}
              >
                ({step.detail})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

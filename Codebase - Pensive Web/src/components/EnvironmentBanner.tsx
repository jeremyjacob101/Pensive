import "./EnvironmentBanner.css";

type Environment = "development" | "staging" | "production";

function getEnvironment(): Environment {
  const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";

  if (convexUrl.includes("third-goshawk-681")) {
    return "development";
  }

  if (convexUrl.includes("mellow-pigeon-433")) {
    return "staging";
  }

  return "production";
}

export function EnvironmentBanner() {
  const environment = getEnvironment();

  if (environment === "production") {
    return null;
  }

  const label = environment === "development" ? "DEVELOPMENT" : "STAGING";

  return (
    <div
      className={`environment-banner environment-banner--${environment}`}
      role="status"
      aria-label={`Application environment: ${label}`}
    >
      {label}
    </div>
  );
}
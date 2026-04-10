import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

export function UserIcon() {
  return (
    <Svg>
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function SettingsIcon() {
  return (
    <Svg>
      <path
        d="M4 7h16M4 17h16M9 7a2 2 0 1 0 0 .01M15 17a2 2 0 1 0 0 .01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function ExportIcon() {
  return (
    <Svg>
      <path
        d="M12 20V10m0 0 4 4m-4-4-4 4M5 6h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <Svg>
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function ChevronRightIcon() {
  return (
    <Svg>
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function PlusIcon() {
  return (
    <Svg>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </Svg>
  );
}

export function EditIcon() {
  return (
    <Svg>
      <path
        d="m6 16.5 7.9-7.9 3.5 3.5-7.9 7.9L6 20l.5-3.5ZM13.9 8.6l1.5-1.5a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1l-1.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function TrashIcon() {
  return (
    <Svg>
      <path
        d="M5 7h14M10 11v5M14 11v5M9 7V5h6v2m-8 0 1 11h8l1-11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function CloseIcon() {
  return (
    <Svg>
      <path
        d="M7 7 17 17M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

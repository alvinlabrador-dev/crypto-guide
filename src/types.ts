import type { AnnualHighHistory } from "../shared/types";

export type AuthState = "loading" | "signed-out" | "signed-in" | "unconfigured";

export type Toast = {
  id: number;
  message: string;
  tone: "success" | "error";
};

export type AnnualHistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AnnualHighHistory }
  | { status: "error"; message: string };

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

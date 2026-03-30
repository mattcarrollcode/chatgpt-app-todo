export type OpenAiGlobals<
  ToolInput = UnknownObject,
  ToolOutput = UnknownObject,
  ToolResponseMetadata = UnknownObject,
  WidgetState = UnknownObject
> = {
  theme: Theme;
  userAgent: UserAgent;
  locale: string;
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
  setWidgetState: (state: WidgetState) => Promise<void>;
};

type API = {
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ result: string }>;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
  openExternal(payload: { href: string }): void;
  requestDisplayMode: (args: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>;
  requestModal: (args: { title?: string; params?: UnknownObject }) => Promise<unknown>;
  requestClose: () => Promise<void>;
};

export type UnknownObject = Record<string, unknown>;
export type Theme = "light" | "dark";
export type DisplayMode = "pip" | "inline" | "fullscreen";

export type SafeArea = {
  insets: { top: number; bottom: number; left: number; right: number };
};

export type UserAgent = {
  device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
  capabilities: { hover: boolean; touch: boolean };
};

export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";
export class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<OpenAiGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}

declare global {
  interface Window {
    openai: API & OpenAiGlobals;
  }
  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}

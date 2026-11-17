import { invoke } from "@tauri-apps/api/core";

export const isMac = navigator.userAgent.includes("Mac");

/** Global shortcut label for the current platform. */
export const shortcutLabel = isMac ? "⌘ ⇧ E" : "Ctrl + Shift + E";

/** Autostart toggle label for the current platform. */
export const autostartLabel = isMac ? "Launch at login" : "Start with Windows";

export const getAutostart = () => invoke<boolean>("get_autostart");
export const setAutostart = (enabled: boolean) => invoke<boolean>("set_autostart", { enabled });

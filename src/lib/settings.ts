import { invoke } from "@tauri-apps/api/core";

export type Provider = "openai" | "anthropic" | "ollama";
export type Language = "pt-BR" | "en";

export interface AppSettings {
  provider: Provider;
  openaiModel: string;
  anthropicModel: string;
  ollamaModel: string;
  ollamaUrl: string;
  language: Language;
}

export const PROVIDERS: Record<
  Provider,
  { label: string; needsKey: boolean; keyHint: string; keyUrl?: string; modelField: keyof AppSettings }
> = {
  openai: {
    label: "OpenAI",
    needsKey: true,
    keyHint: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    modelField: "openaiModel",
  },
  anthropic: {
    label: "Anthropic",
    needsKey: true,
    keyHint: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    modelField: "anthropicModel",
  },
  ollama: { label: "Ollama (local)", needsKey: false, keyHint: "", modelField: "ollamaModel" },
};

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) => invoke<AppSettings>("save_settings", { settings });

// A API key só trafega no sentido frontend → keychain. Não existe comando para lê-la.
export const hasApiKey = (provider: Provider) => invoke<boolean>("has_api_key", { provider });
export const setApiKey = (provider: Provider, key: string) => invoke<void>("set_api_key", { provider, key });
export const deleteApiKey = (provider: Provider) => invoke<void>("delete_api_key", { provider });


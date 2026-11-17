import { invoke } from "@tauri-apps/api/core";

export interface BillingStatus {
  isPro: boolean;
  plan: "free" | "pro";
  todayUsed: number;
  dailyLimit: number;
  totalAnalyses: number;
  estimatedMinutesSaved: number;
  lastValidatedAt: number | null;
  offlineValidUntil: number | null;
  customerEmail: string | null;
  checkoutUrl: string;
}

export const getBillingStatus = () => invoke<BillingStatus>("get_billing_status");

export const activateLicense = (licenseKey: string) =>
  invoke<BillingStatus>("activate_license", { licenseKey });

export const revalidateLicense = () => invoke<BillingStatus>("revalidate_license");

export const deactivateLicense = () => invoke<BillingStatus>("deactivate_license");

export const openCheckout = () => invoke<void>("open_checkout");

export function formatTimeSaved(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}


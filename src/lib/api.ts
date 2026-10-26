/**
 * Client for the ATHAR Google Apps Script backend (google-apps-script/Code.gs).
 * When no URL is configured the store runs in local demo mode (data stays in this browser).
 */
import { SHEETS_API_URL } from "../config";

export const API_URL: string = (import.meta.env.VITE_SHEETS_API_URL as string | undefined) || SHEETS_API_URL || "";
// The single-file preview runs in a sandbox that can't reach Google, so it always uses demo mode.
export const REMOTE = !!API_URL && !__SINGLE__;

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

export async function call<T = unknown>(action: string, payload: Record<string, unknown> = {}, token?: string | null): Promise<T> {
  let res: Response;
  try {
    // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token: token ?? undefined, ...payload }),
      redirect: "follow",
    });
  } catch {
    throw new ApiError("Can't reach the store server. Check your connection and try again.", "network");
  }
  let j: { ok: boolean; data?: T; error?: string; code?: string };
  try { j = await res.json(); } catch { throw new ApiError("The store server sent an unexpected reply. Try again in a moment.", "bad-response"); }
  if (!j.ok) throw new ApiError(j.error || "Something went wrong on the store server.", j.code);
  return j.data as T;
}

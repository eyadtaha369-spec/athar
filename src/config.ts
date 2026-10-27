/**
 * Google Apps Script web app URL (ends in /exec). See google-apps-script/SETUP.md.
 * Leave empty to run the store in local demo mode.
 * A VITE_SHEETS_API_URL environment variable in Vercel overrides this.
 */
export const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxJRcm3zlaT_XJ6Wn534UhjUncb01fSYYo4kYaX7lWoaPhqQvvfADxn2slPdAPW8NnLaA/exec";

/** Public VAPID key for Web Push (safe to publish). The matching private key lives only in Vercel's
 * VAPID_PRIVATE_KEY environment variable, used by api/push.js. */
export const VAPID_PUBLIC_KEY = "BOG0-4oQqk7fc2jP7wddgNavNk-dpkDr0SkuLfVy1lHgqEmyWiKq5FI3ohdGDQQH6H1LuU8t1Gssmm7qpgis7O8";

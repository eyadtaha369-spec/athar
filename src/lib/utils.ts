export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const egp = (n: number) =>
  new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(n) + " EGP";

export const fmtDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads an image file, downsizes it and returns a JPEG data URL (keeps storage small). */
export function compressImage(file: File, max = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Upload an image file (JPG, PNG or HEIC screenshot)."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read. Try another screenshot."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image format isn't supported. Upload a JPG or PNG."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Dakahlia", "Sharqia", "Gharbia", "Monufia",
  "Beheira", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia", "Suez", "Fayoum",
  "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan", "Red Sea",
  "Matrouh", "New Valley", "North Sinai", "South Sinai",
];

export const isCoreZone = (g: string) => ["Cairo", "Giza", "Alexandria"].includes(g);

export const CATEGORY_LABEL: Record<string, { en: string; ar: string }> = {
  posters: { en: "Posters & Wall Art", ar: "بوسترات" },
  sleeves: { en: "Laptop Sleeves", ar: "جرابات لابتوب" },
  flags: { en: "Flags", ar: "أعلام" },
  cases: { en: "Phone Cases", ar: "جرابات موبايل" },
  sunshades: { en: "Car Sunshades", ar: "شمسية العربية" },
  umbrellas: { en: "Umbrellas", ar: "شماسي" },
};

export const STATUS_META: Record<string, { label: string; ar: string; cls: string }> = {
  pending:   { label: "Pending verification", ar: "في انتظار التأكيد", cls: "bg-[#F3E3C3] text-[#7A5317]" },
  confirmed: { label: "Confirmed", ar: "تم التأكيد",   cls: "bg-[#E3E7DC] text-zeyti" },
  shipped:   { label: "Shipped",   ar: "تم الشحن",     cls: "bg-[#DCE4EA] text-[#3D5566]" },
  delivered: { label: "Delivered", ar: "تم التسليم",   cls: "bg-fahmy text-sand" },
  cancelled: { label: "Cancelled", ar: "ملغي",          cls: "bg-[#F1DCD3] text-topy-dark" },
};

/** Deposit actually counted for an order: the admin-verified amount once checked. */
export const depositOf = (o: { payment: { deposit: number; verifiedDeposit?: number } }) => o.payment.verifiedDeposit ?? o.payment.deposit;

/** Standard delivery time for every order. */
export const DELIVERY_ETA = { en: "5 to 7 working days", ar: "من 5 إلى 7 أيام عمل" };

/** Delivery fee for a cart: free from the threshold up, otherwise the zone rate. */
export function shippingFee(subtotal: number, governorate: string, s: { freeShippingOver: number; shippingCairoAlex: number; shippingOther: number }) {
  if (subtotal >= s.freeShippingOver) return 0;
  return isCoreZone(governorate) ? s.shippingCairoAlex : s.shippingOther;
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

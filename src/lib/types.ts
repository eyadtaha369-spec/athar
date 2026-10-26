export type Category = "posters" | "sleeves" | "flags" | "cases" | "sunshades" | "umbrellas";

export type ArtKind =
  | "pyramids" | "karnak" | "nile" | "hieroglyph" | "sun" | "abstract"
  | "sleeve" | "flag" | "case" | "sunshade" | "umbrella";

export interface Variant { id: string; label: string; price: number }   // price = final customer selling price (EGP)

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  category: Category;
  collection?: string;   // e.g. "Garage", "Sky" for flags
  price: number;          // EGP, lowest selling price (kept in sync with variants)
  compareAt?: number;     // optional old price
  stock: number;          // units available
  active: boolean;
  featured: boolean;
  description: string;
  details: string[];
  variants: Variant[];
  variantLabel?: string;  // e.g. "Size", "Phone model"
  customText?: string;    // label for a personalisation field, if any
  images: string[];       // uploaded data URLs (or storage URLs)
  art: ArtKind;           // generated artwork when no image uploaded
  palette: [string, string, string];
  createdAt: string;
}

export interface CartItem {
  key: string;
  productId: string;
  variantId?: string;
  custom?: string;
  qty: number;
}

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type PayMethod = "instapay" | "wallet" | "bank";

export interface OrderLine {
  productId: string;
  name: string;
  variant?: string;
  custom?: string;
  unitPrice: number;
  qty: number;
}

export interface Order {
  id: string;
  number: string;          // ATH-1042
  createdAt: string;
  customer: { name: string; phone: string; email?: string };
  shipping: { governorate: string; city: string; address: string; notes?: string };
  lines: OrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  payment: {
    method: PayMethod;
    reference?: string;
    senderName?: string;
    receipt: string;          // screenshot of the deposit transfer
    deposit: number;          // amount the customer says they transferred
    verifiedDeposit?: number; // amount the admin confirmed on the receipt
  };
  codDue: number;             // balance collected in cash on delivery
  codCollected?: boolean;
  status: OrderStatus;
  history: { status: OrderStatus; at: string; by?: string; note?: string }[];
  paymentVerified: boolean;
  sample?: boolean;
}

export type AdminRole = "owner" | "admin" | "staff";
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Notice {
  id: string;
  orderId: string;
  text: string;
  at: string;
  read: boolean;
}

export interface Settings {
  instapay: { handle: string; name: string };
  wallet: { number: string; name: string; providers: string };
  bank: { bank: string; accountName: string; iban: string };
  shippingCairoAlex: number;
  shippingOther: number;
  freeShippingOver: number;
  minDeposit: number;        // smallest deposit accepted at checkout (EGP)
  whatsapp: string;
}

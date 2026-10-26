import type { Product, Order, OrderStatus, Settings } from "./types";
import { FLAG_PRODUCTS, LIFESTYLE } from "./catalog";

const now = Date.now();
const daysAgo = (d: number, h = 0) => new Date(now - d * 864e5 - h * 36e5).toISOString();

const posterSizes = [
  { id: "a3", label: "A3 — 30×42 cm", priceDelta: 0 },
  { id: "a2", label: "A2 — 42×59 cm", priceDelta: 200 },
  { id: "50x70", label: "50×70 cm", priceDelta: 400 },
];
const posterDetails = [
  "Printed on 250gsm matte art paper",
  "Fade-resistant pigment inks",
  "Ships rolled in a kraft tube",
  "Frame not included",
];
const phoneModels = [
  { id: "ip15", label: "iPhone 15 / 15 Pro", priceDelta: 0 },
  { id: "ip16", label: "iPhone 16 / 16 Pro", priceDelta: 0 },
  { id: "ip16pm", label: "iPhone 16 Pro Max", priceDelta: 30 },
  { id: "s24", label: "Samsung S24 / S24 Ultra", priceDelta: 0 },
  { id: "a55", label: "Samsung A55", priceDelta: -30 },
  { id: "rn13", label: "Redmi Note 13", priceDelta: -30 },
];

const BASE: Product[] = [
  {
    id: "p1", slug: "giza-at-dusk", name: "Giza at Dusk", nameAr: "الجيزة وقت الغروب",
    category: "posters", price: 350, stock: 40, active: true, featured: true,
    description: "The three pyramids reduced to flat planes of clay and sand, with the sun dropping behind Khafre. Made for a hallway or the wall above your desk.",
    details: posterDetails, variants: posterSizes, variantLabel: "Size",
    images: [], art: "pyramids", palette: ["#A85B3E", "#E3DAC9", "#222222"], createdAt: daysAgo(60),
  },
  {
    id: "p2", slug: "karnak-columns", name: "Karnak Columns", nameAr: "أعمدة الكرنك",
    category: "posters", price: 350, stock: 32, active: true, featured: true,
    description: "The hypostyle hall at Karnak, drawn as a rhythm of papyrus columns in olive and sand.",
    details: posterDetails, variants: posterSizes, variantLabel: "Size",
    images: [], art: "karnak", palette: ["#606859", "#E3DAC9", "#222222"], createdAt: daysAgo(55),
  },
  {
    id: "p3", slug: "nile-lines", name: "Nile Lines", nameAr: "خطوط النيل",
    category: "posters", price: 320, compareAt: 380, stock: 25, active: true, featured: false,
    description: "An abstract map of the Nile from Aswan to the Delta — one continuous line splitting into its seven historic branches.",
    details: posterDetails, variants: posterSizes, variantLabel: "Size",
    images: [], art: "nile", palette: ["#222222", "#E3DAC9", "#A85B3E"], createdAt: daysAgo(40),
  },
  {
    id: "p4", slug: "hieroglyph-grid", name: "Hieroglyph Grid", nameAr: "شبكة الهيروغليفي",
    category: "posters", price: 350, stock: 18, active: true, featured: true,
    description: "Twelve signs from the Egyptian uniliteral alphabet set on a strict grid. Find the letters of your own name.",
    details: posterDetails, variants: posterSizes, variantLabel: "Size",
    images: [], art: "hieroglyph", palette: ["#E3DAC9", "#A85B3E", "#222222"], createdAt: daysAgo(30),
  },
  {
    id: "p5", slug: "ra-rising", name: "Ra Rising", nameAr: "شروق رع",
    category: "posters", price: 300, stock: 22, active: true, featured: false,
    description: "A winged sun disc in terracotta over a horizon of stacked sand dunes. Bold, simple, warm.",
    details: posterDetails, variants: posterSizes, variantLabel: "Size",
    images: [], art: "sun", palette: ["#A85B3E", "#606859", "#EFECE6"], createdAt: daysAgo(20),
  },
  {
    id: "p6", slug: "felt-laptop-sleeve-sand", name: "Felt Laptop Sleeve — Sand", nameAr: "جراب لابتوب فلت — رملي",
    category: "sleeves", price: 650, stock: 30, active: true, featured: true,
    description: "Thick wool-blend felt with a leather strap and a pocket for your charger. Slim enough to slide into any backpack.",
    details: ["5mm wool-blend felt", "Genuine leather strap with snap", "Front pocket for charger and cables", "Soft microfibre lining"],
    variants: [
      { id: "13", label: '13" (MacBook Air 13)', priceDelta: 0 },
      { id: "14", label: '14" (MacBook Pro 14)', priceDelta: 50 },
      { id: "16", label: '15–16"', priceDelta: 100 },
    ], variantLabel: "Size",
    images: [], art: "sleeve", palette: ["#E3DAC9", "#A85B3E", "#222222"], createdAt: daysAgo(50),
  },
  {
    id: "p7", slug: "felt-laptop-sleeve-olive", name: "Felt Laptop Sleeve — Olive", nameAr: "جراب لابتوب فلت — زيتي",
    category: "sleeves", price: 650, stock: 4, active: true, featured: false,
    description: "The same sleeve in deep olive felt with a charcoal strap.",
    details: ["5mm wool-blend felt", "Leather strap with snap", "Front pocket for charger and cables", "Soft microfibre lining"],
    variants: [
      { id: "13", label: '13" (MacBook Air 13)', priceDelta: 0 },
      { id: "14", label: '14" (MacBook Pro 14)', priceDelta: 50 },
      { id: "16", label: '15–16"', priceDelta: 100 },
    ], variantLabel: "Size",
    images: [], art: "sleeve", palette: ["#606859", "#222222", "#E3DAC9"], createdAt: daysAgo(35),
  },
  {
    id: "p8", slug: "custom-flag", name: "Custom Flag", nameAr: "علم بتصميمك",
    category: "flags", price: 420, stock: 100, active: true, featured: true,
    description: "Your name, your team, your family, your shop. Send us the text and we print it on a full-colour polyester flag with brass grommets.",
    details: ["Knitted polyester, vivid on both sides", "Two brass grommets for hanging", "We send a design proof on WhatsApp before printing", "Printed within 3 working days"],
    variants: [
      { id: "60x90", label: "60×90 cm", priceDelta: 0 },
      { id: "90x150", label: "90×150 cm", priceDelta: 180 },
    ], variantLabel: "Size", customText: "Text on your flag",
    images: [], art: "flag", palette: ["#A85B3E", "#EFECE6", "#222222"], createdAt: daysAgo(45),
  },
  {
    id: "p9", slug: "pyramids-phone-case", name: "Pyramids Phone Case", nameAr: "جراب الأهرامات",
    category: "cases", price: 280, stock: 60, active: true, featured: true,
    description: "Matte tough case with the Giza at Dusk artwork wrapping the back. Raised edges protect the camera.",
    details: ["Dual-layer TPU + polycarbonate", "Matte, fingerprint-resistant finish", "Raised camera lip", "Wireless-charging compatible"],
    variants: phoneModels, variantLabel: "Phone model",
    images: [], art: "case", palette: ["#A85B3E", "#E3DAC9", "#222222"], createdAt: daysAgo(48),
  },
  {
    id: "p10", slug: "name-in-hieroglyphs-case", name: "Your Name in Hieroglyphs", nameAr: "اسمك بالهيروغليفي",
    category: "cases", price: 320, stock: 60, active: true, featured: false,
    description: "We spell your name in hieroglyphs inside a cartouche, printed on a sand-coloured matte case.",
    details: ["Dual-layer TPU + polycarbonate", "Cartouche artwork made for your name", "Raised camera lip", "Wireless-charging compatible"],
    variants: phoneModels, variantLabel: "Phone model", customText: "Name for the cartouche",
    images: [], art: "case", palette: ["#E3DAC9", "#606859", "#A85B3E"], createdAt: daysAgo(25),
  },
  {
    id: "p11", slug: "pyramids-car-sunshade", name: "Pyramids Car Sunshade", nameAr: "شمسية عربية الأهرامات",
    category: "sunshades", price: 550, stock: 20, active: true, featured: true,
    description: "Foldable windshield shade printed with the pyramids skyline. Keeps the cabin cooler through an Egyptian August.",
    details: ["Reflective silver backing", "Folds into a pouch the size of a plate", "Fits most sedans and SUVs", "Printed artwork faces outward"],
    variants: [
      { id: "std", label: "Standard — 130×70 cm", priceDelta: 0 },
      { id: "xl", label: "SUV / XL — 150×80 cm", priceDelta: 80 },
    ], variantLabel: "Size",
    images: [], art: "sunshade", palette: ["#A85B3E", "#E3DAC9", "#222222"], createdAt: daysAgo(42),
  },
  {
    id: "p12", slug: "nile-car-sunshade", name: "Nile Lines Sunshade", nameAr: "شمسية عربية النيل",
    category: "sunshades", price: 550, stock: 0, active: true, featured: false,
    description: "The Nile Lines artwork across your windshield, in charcoal and sand.",
    details: ["Reflective silver backing", "Folds into a compact pouch", "Fits most sedans and SUVs"],
    variants: [
      { id: "std", label: "Standard — 130×70 cm", priceDelta: 0 },
      { id: "xl", label: "SUV / XL — 150×80 cm", priceDelta: 80 },
    ], variantLabel: "Size",
    images: [], art: "sunshade", palette: ["#222222", "#E3DAC9", "#A85B3E"], createdAt: daysAgo(15),
  },
  {
    id: "p13", slug: "olive-grove-umbrella", name: "Olive Grove Umbrella", nameAr: "شمسية زيتي",
    category: "umbrellas", price: 600, stock: 14, active: true, featured: true,
    description: "Automatic open-and-close umbrella with a UV-blocking canopy. Olive outside, a terracotta sun pattern inside.",
    details: ["UPF 50+ canopy for summer sun", "Windproof fibreglass ribs", "One-button auto open/close", "Wooden J-handle"],
    variants: [], images: [], art: "umbrella", palette: ["#606859", "#A85B3E", "#E3DAC9"], createdAt: daysAgo(38),
  },
  {
    id: "p14", slug: "clay-umbrella", name: "Clay Umbrella", nameAr: "شمسية طوبي",
    category: "umbrellas", price: 600, stock: 9, active: true, featured: false,
    description: "The same umbrella in terracotta clay with a sand interior.",
    details: ["UPF 50+ canopy", "Windproof fibreglass ribs", "One-button auto open/close", "Wooden J-handle"],
    variants: [], images: [], art: "umbrella", palette: ["#A85B3E", "#E3DAC9", "#222222"], createdAt: daysAgo(12),
  },
];

export const SEED_PRODUCTS: Product[] = [
  ...FLAG_PRODUCTS,
  ...BASE.map((p) => ({ ...p, ...(LIFESTYLE[p.id] ?? {}) })),
];

export const SEED_SETTINGS: Settings = {
  instapay: { handle: "athar@instapay", name: "ATHAR Store" },
  wallet: { number: "01000000000", name: "ATHAR Store", providers: "Vodafone Cash, Etisalat Cash, Orange Cash, WE Pay" },
  bank: { bank: "CIB", accountName: "ATHAR for Trading", iban: "EG00 0000 0000 0000 0000 0000 0000 0" },
  shippingCairoAlex: 70,
  shippingOther: 95,
  freeShippingOver: 1500,
  whatsapp: "+20 100 000 0000",
};

/** A small generated "transfer receipt" image used for sample orders. */
export function sampleReceipt(ref: string, amount: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='640' viewBox='0 0 360 640'>
  <rect width='360' height='640' fill='#f5f5f7'/><rect width='360' height='120' fill='#5b2d82'/>
  <text x='24' y='64' font-family='Arial' font-size='22' fill='#fff' font-weight='700'>InstaPay</text>
  <text x='24' y='92' font-family='Arial' font-size='13' fill='#e4d8ef'>Transfer successful</text>
  <circle cx='180' cy='190' r='34' fill='#2bb673'/><path d='M164 190l11 11 22-23' stroke='#fff' stroke-width='6' fill='none'/>
  <text x='180' y='270' text-anchor='middle' font-family='Arial' font-size='30' font-weight='700' fill='#222'>${amount} EGP</text>
  <text x='24' y='330' font-family='Arial' font-size='13' fill='#777'>To</text><text x='336' y='330' text-anchor='end' font-family='Arial' font-size='13' fill='#222'>athar@instapay</text>
  <text x='24' y='370' font-family='Arial' font-size='13' fill='#777'>Reference</text><text x='336' y='370' text-anchor='end' font-family='Arial' font-size='13' fill='#222'>${ref}</text>
  <text x='24' y='410' font-family='Arial' font-size='13' fill='#777'>Status</text><text x='336' y='410' text-anchor='end' font-family='Arial' font-size='13' fill='#2bb673'>Completed</text>
  <text x='180' y='600' text-anchor='middle' font-family='Arial' font-size='11' fill='#aaa'>SAMPLE RECEIPT — DEMO DATA</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const NAMES = [
  ["Nour Hassan", "01012345678", "Cairo", "Nasr City"], ["Omar Khaled", "01123456789", "Alexandria", "Smouha"],
  ["Mariam Adel", "01234567890", "Giza", "Sheikh Zayed"], ["Youssef Tarek", "01098765432", "Dakahlia", "Mansoura"],
  ["Salma Mostafa", "01187654321", "Cairo", "Maadi"], ["Karim Samir", "01276543210", "Alexandria", "Sidi Gaber"],
  ["Hana Ibrahim", "01011122233", "Sharqia", "Zagazig"], ["Ahmed Fathy", "01522233344", "Giza", "Dokki"],
  ["Laila Ashraf", "01033344455", "Cairo", "Heliopolis"], ["Mahmoud Reda", "01144455566", "Luxor", "Luxor City"],
];

export function seedOrders(products: Product[]): Order[] {
  const plan: [number, number, [string, number, number][], OrderStatus][] = [
    // [daysAgo, nameIdx, [productId, variantIdx, qty][], status]
    [0, 0, [["p1", 1, 1], ["p9", 1, 1]], "pending"],
    [0, 1, [["f4", 0, 1], ["f2", 0, 1]], "pending"],
    [1, 2, [["p6", 1, 1]], "confirmed"],
    [1, 3, [["p11", 0, 1], ["p4", 0, 1]], "confirmed"],
    [2, 4, [["p9", 0, 1], ["p10", 3, 1]], "shipped"],
    [3, 5, [["p1", 0, 2]], "shipped"],
    [3, 6, [["p13", 0, 1]], "delivered"],
    [4, 7, [["f6", 0, 1], ["f7", 0, 1]], "delivered"],
    [5, 8, [["p9", 2, 1]], "delivered"],
    [6, 9, [["f8", 0, 1]], "delivered"],
    [7, 0, [["f10", 0, 1], ["f1", 0, 1]], "delivered"],
    [8, 2, [["f1", 1, 1], ["f5", 0, 1]], "delivered"],
    [9, 4, [["f6", 1, 1], ["p9", 0, 1]], "delivered"],
    [10, 1, [["p6", 0, 1], ["p1", 0, 1]], "delivered"],
    [11, 5, [["f9", 0, 1]], "cancelled"],
    [12, 3, [["f8", 1, 1]], "delivered"],
    [13, 7, [["p1", 1, 1], ["p8", 0, 1]], "delivered"],
  ];
  const flow: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];
  return plan.map(([d, ni, items, status], i) => {
    const n = NAMES[ni];
    const lines = items.map(([pid, vi, qty]) => {
      const p = products.find((x) => x.id === pid)!;
      const v = p.variants[vi];
      return {
        productId: p.id, name: p.name, variant: v?.label,
        custom: p.customText ? (p.category === "flags" ? "Ahly Forever" : n[0].split(" ")[0]) : undefined,
        unitPrice: p.price + (v?.priceDelta ?? 0), qty,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const fee = subtotal >= 1500 ? 0 : ["Cairo", "Giza", "Alexandria"].includes(n[2]) ? 70 : 95;
    const createdAt = daysAgo(d, (i * 5) % 11);
    const steps = status === "cancelled" ? ["pending", "cancelled"] : flow.slice(0, flow.indexOf(status) + 1);
    const ref = "IP" + (88213400 + i * 137);
    return {
      id: "s" + i, number: "ATH-" + (1001 + plan.length - i), createdAt,
      customer: { name: n[0], phone: n[1] },
      shipping: { governorate: n[2], city: n[3], address: `${12 + i} Street ${i + 3}, ${n[3]}` },
      lines, subtotal, shippingFee: fee, total: subtotal + fee,
      payment: { method: i % 3 === 0 ? "wallet" : "instapay", reference: ref, senderName: n[0], receipt: sampleReceipt(ref, subtotal + fee) },
      status,
      history: steps.map((s, k) => ({ status: s as OrderStatus, at: new Date(new Date(createdAt).getTime() + k * 6 * 36e5).toISOString(), by: k ? "Store owner" : undefined })),
      paymentVerified: status !== "pending" && status !== "cancelled",
      sample: true,
    };
  });
}

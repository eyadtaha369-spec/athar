import type { Product } from "./types";
import { fromPrice, presetVariants } from "./pricing";

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const flagDetails = [
  "Knitted polyester, printed edge to edge",
  "Colours stay sharp in direct sun",
  "Four brass grommets, wall hooks included",
  "Machine washable, cold and gentle",
];

type F = [slug: string, name: string, nameAr: string, collection: string, shape: "rect" | "square", desc: string, featured?: boolean, stock?: number];

const FLAGS: F[] = [
  ["aurora-valley", "Aurora Valley", "وادي الشفق", "Sky", "rect", "Northern lights pouring over a frozen river valley. Deep violet and green that glow in a dim room.", true],
  ["danger-zone", "Danger Zone", "منطقة خطر", "Signs", "rect", "A worn enamel warning sign, rust and all. For the bedroom door you'd rather nobody opened.", true],
  ["do-not-disturb", "Do Not Disturb", "ممنوع الإزعاج", "Signs", "rect", "Faded red, distressed lettering, zero ambiguity. Hang it above the desk during exam season."],
  ["thousands-of-tears", "Thousands of Tears Later", "بعد آلاف الدموع", "Mood", "square", "The title card everyone knows, for the room where the studying happens.", true],
  ["milky-way", "Milky Way Ridge", "درب التبانة", "Sky", "rect", "The galactic core rising over a dark mountain line. Quiet, huge, and calm on the wall."],
  ["ducati-v4", "Panigale V4", "دوكاتي V4", "Garage", "rect", "Race red superbike with the full spec strip along the bottom. Made for the garage wall.", true],
  ["bmw-m4", "M4 Street", "BMW M4", "Garage", "rect", "A white M4 in a cloud of tyre smoke, splashed with red ink and city grit.", true],
  ["the-godfather", "The Godfather, Egyptian Cut", "الأب الروحي", "Cinema", "square", "The famous office scene, with a torn-paper twist only an Egyptian living room would get.", true],
  ["pink-p1", "Pink P1", "P1 الوردية", "Garage", "rect", "The rear of a hypercar in soft pink, every pipe and wing on show."],
  ["starry-castle", "Starry Castle", "القلعة المضيئة", "Art", "rect", "Swirling night sky over a lit castle on a hill, painted in thick blue brushwork.", true],
  ["mental-breakdown", "One Mental Breakdown Later", "بعد انهيار عصبي", "Mood", "square", "Bold black letters and pastel flowers. Every student's honest progress report."],
  ["dont-stop-the-music", "Don't Stop the Music", "متوقفش المزيكا", "Signs", "rect", "A weathered stop sign with one job: keep the speakers on.", false, 3],
];

export const FLAG_PRODUCTS: Product[] = FLAGS.map(([slug, name, nameAr, collection, shape, description, featured = false, stock = 25], i) => ({
  id: "f" + (i + 1),
  slug, name, nameAr, collection,
  category: "flags",
  price: fromPrice(presetVariants("flags"), 340),
  stock, active: true, featured,
  description,
  details: flagDetails,
  variants: presetVariants("flags"),
  variantLabel: "Size",
  images: [],
  art: "flag",
  palette: ["#222222", "#E6DED1", "#A85B3E"],
  createdAt: ago(5 + i * 3),
}));

/** Real ATHAR photography for the core products. */
export const LIFESTYLE: Record<string, Partial<Product>> = {
  p9: {
    name: "Signature Phone Case", nameAr: "جراب أثر", slug: "signature-phone-case",
    description: "Soft-touch matte case with the أثر icon in sand. Comes in charcoal, sand, olive and clay; tell us your colour in the order notes.",
  },
  p11: {
    name: "Signature Car Sunshade", nameAr: "شمسية عربية أثر", slug: "signature-car-sunshade",
    description: "Charcoal windshield shade with the أثر logo facing out. Keeps the cabin cooler through an Egyptian August.",
  },
  p13: {
    name: "Signature Umbrella", nameAr: "شمسية أثر", slug: "signature-umbrella",
    description: "Black automatic umbrella with a UV-blocking canopy and the أثر mark printed in sand.",
  },
};

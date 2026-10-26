// Product and brand imagery. Products reference these as "asset:<key>" so the
// browser database stays small; uploaded photos are stored as normal URLs.

import a_flags_aurora_valley_cover from "../assets/flags/aurora-valley-cover.webp";
import a_flags_aurora_valley from "../assets/flags/aurora-valley.webp";
import a_flags_bmw_m4_cover from "../assets/flags/bmw-m4-cover.webp";
import a_flags_bmw_m4 from "../assets/flags/bmw-m4.webp";
import a_flags_danger_zone_cover from "../assets/flags/danger-zone-cover.webp";
import a_flags_danger_zone from "../assets/flags/danger-zone.webp";
import a_flags_do_not_disturb_cover from "../assets/flags/do-not-disturb-cover.webp";
import a_flags_do_not_disturb from "../assets/flags/do-not-disturb.webp";
import a_flags_dont_stop_the_music_cover from "../assets/flags/dont-stop-the-music-cover.webp";
import a_flags_dont_stop_the_music from "../assets/flags/dont-stop-the-music.webp";
import a_flags_ducati_v4_cover from "../assets/flags/ducati-v4-cover.webp";
import a_flags_ducati_v4 from "../assets/flags/ducati-v4.webp";
import a_flags_mental_breakdown_cover from "../assets/flags/mental-breakdown-cover.webp";
import a_flags_mental_breakdown from "../assets/flags/mental-breakdown.webp";
import a_flags_milky_way_cover from "../assets/flags/milky-way-cover.webp";
import a_flags_milky_way from "../assets/flags/milky-way.webp";
import a_flags_pink_p1_cover from "../assets/flags/pink-p1-cover.webp";
import a_flags_pink_p1 from "../assets/flags/pink-p1.webp";
import a_flags_starry_castle_cover from "../assets/flags/starry-castle-cover.webp";
import a_flags_starry_castle from "../assets/flags/starry-castle.webp";
import a_flags_the_godfather_cover from "../assets/flags/the-godfather-cover.webp";
import a_flags_the_godfather from "../assets/flags/the-godfather.webp";
import a_flags_thousands_of_tears_cover from "../assets/flags/thousands-of-tears-cover.webp";
import a_flags_thousands_of_tears from "../assets/flags/thousands-of-tears.webp";
import a_life_board_dark from "../assets/life/board-dark.webp";
import a_life_case_hand from "../assets/life/case-hand.webp";
import a_life_cases from "../assets/life/cases.webp";
import a_life_poster_flag from "../assets/life/poster-flag.webp";
import a_life_sunshade from "../assets/life/sunshade.webp";
import a_life_umbrella from "../assets/life/umbrella.webp";
import a_life_wall_posters from "../assets/life/wall-posters.webp";
import a_brand_icon from "../assets/brand/icon.png";
import a_brand_logo_ar from "../assets/brand/logo-ar.png";
import a_brand_pattern from "../assets/brand/pattern.jpg";

export const ASSETS: Record<string, string> = {
  "flags/aurora-valley-cover": a_flags_aurora_valley_cover,
  "flags/aurora-valley": a_flags_aurora_valley,
  "flags/bmw-m4-cover": a_flags_bmw_m4_cover,
  "flags/bmw-m4": a_flags_bmw_m4,
  "flags/danger-zone-cover": a_flags_danger_zone_cover,
  "flags/danger-zone": a_flags_danger_zone,
  "flags/do-not-disturb-cover": a_flags_do_not_disturb_cover,
  "flags/do-not-disturb": a_flags_do_not_disturb,
  "flags/dont-stop-the-music-cover": a_flags_dont_stop_the_music_cover,
  "flags/dont-stop-the-music": a_flags_dont_stop_the_music,
  "flags/ducati-v4-cover": a_flags_ducati_v4_cover,
  "flags/ducati-v4": a_flags_ducati_v4,
  "flags/mental-breakdown-cover": a_flags_mental_breakdown_cover,
  "flags/mental-breakdown": a_flags_mental_breakdown,
  "flags/milky-way-cover": a_flags_milky_way_cover,
  "flags/milky-way": a_flags_milky_way,
  "flags/pink-p1-cover": a_flags_pink_p1_cover,
  "flags/pink-p1": a_flags_pink_p1,
  "flags/starry-castle-cover": a_flags_starry_castle_cover,
  "flags/starry-castle": a_flags_starry_castle,
  "flags/the-godfather-cover": a_flags_the_godfather_cover,
  "flags/the-godfather": a_flags_the_godfather,
  "flags/thousands-of-tears-cover": a_flags_thousands_of_tears_cover,
  "flags/thousands-of-tears": a_flags_thousands_of_tears,
  "life/board-dark": a_life_board_dark,
  "life/case-hand": a_life_case_hand,
  "life/cases": a_life_cases,
  "life/poster-flag": a_life_poster_flag,
  "life/sunshade": a_life_sunshade,
  "life/umbrella": a_life_umbrella,
  "life/wall-posters": a_life_wall_posters,
  "brand/icon": a_brand_icon,
  "brand/logo-ar": a_brand_logo_ar,
  "brand/pattern": a_brand_pattern,
};

export const img = (src?: string) => (src && src.startsWith("asset:") ? ASSETS[src.slice(6)] ?? "" : src ?? "");

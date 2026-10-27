import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ImagePlaceholder, Mark } from "./ui";

const CARDS = ["Flags", "Posters", "Phone cases", "Laptop sleeves", "Sunshades"];
const KEY = "athar:intro-seen";

/** Opening sequence: a counter runs to 100 while flags stack into the vault, then the curtain lifts. */
export default function Preloader() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(KEY); } catch { return true; }
  });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!show) return;
    if (reduce) { setShow(false); return; }
    document.documentElement.style.overflow = "hidden";
    const start = performance.now();
    const dur = 2100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(100 * (1 - Math.pow(1 - p, 2.2))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => {
        try { sessionStorage.setItem(KEY, "1"); } catch {}
        setShow(false);
      }, 350);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.documentElement.style.overflow = ""; };
  }, [show, reduce]);

  useEffect(() => { if (!show) document.documentElement.style.overflow = ""; }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] bg-ink text-sand overflow-hidden"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden
        >
          <div className="absolute inset-0 lattice text-sand/[0.04]" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative w-[min(62vw,340px)] aspect-[4/5]">
              {CARDS.map((k, i) => (
                <motion.div
                  key={k}
                  className="absolute inset-0 rounded-xl overflow-hidden border border-sand/15 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]"
                  initial={{ y: "120vh", rotate: (i % 2 ? 1 : -1) * (18 + i * 4), x: (i - 2) * 60 }}
                  animate={{ y: 0, rotate: (i - 2) * 5, x: (i - 2) * 18 }}
                  transition={{ delay: 0.15 + i * 0.28, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <ImagePlaceholder title={k} tone={i % 2 ? "dark" : "sand"} />
                </motion.div>
              ))}
            </div>
          </div>
          <div className="absolute left-0 right-0 bottom-0 gutter pb-8 md:pb-12 flex items-end justify-between gap-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}>
            <span className="display tnum text-[26vw] md:text-[180px]">{String(n).padStart(3, "0")}</span>
            <div className="text-right pb-3">
              <Mark className="h-10 md:h-14 text-topy" />
              <p className="logotype text-[10px] md:text-xs text-ramady mt-3">More than just products</p>
            </div>
          </div>
          <div className="absolute left-0 bottom-0 h-[3px] bg-topy" style={{ width: `${n}%` }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

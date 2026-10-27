import type { ArtKind } from "../lib/types";

/** Generated product artwork, used whenever a product has no uploaded photo. */
export default function ProductArt({
  kind, palette, text, className = "",
}: { kind: ArtKind; palette: [string, string, string]; text?: string; className?: string }) {
  const [a, b, c] = palette;
  const id = kind + a.slice(1) + b.slice(1);
  return (
    <svg viewBox="0 0 400 500" className={className} role="img" aria-label={kind} preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id={"cp" + id}><rect x="70" y="60" width="260" height="380" rx="44" /></clipPath>
        <clipPath id={"ws" + id}><path d="M60 170 Q200 130 340 170 L370 360 Q200 390 30 360 Z" /></clipPath>
      </defs>
      {renders[kind]?.(a, b, c, id, text)}
    </svg>
  );
}

const Pyramids = (a: string, b: string, c: string, ox = 0, oy = 0, s = 1) => (
  <g transform={`translate(${ox} ${oy}) scale(${s})`}>
    <rect width="400" height="500" fill={b} />
    <circle cx="250" cy="215" r="62" fill={a} />
    <rect y="330" width="400" height="170" fill={a} opacity=".18" />
    <path d="M20 340 L130 205 L240 340 Z" fill={c} />
    <path d="M130 205 L240 340 L160 340 Z" fill={a} opacity=".55" />
    <path d="M170 340 L270 175 L380 340 Z" fill={c} />
    <path d="M270 175 L380 340 L300 340 Z" fill={a} opacity=".55" />
    <path d="M300 340 L345 282 L395 340 Z" fill={c} />
    <rect y="340" width="400" height="6" fill={c} />
  </g>
);

const poster = (inner: JSX.Element, frame: string) => (
  <>
    <rect width="400" height="500" fill={frame} />
    <g transform="translate(36 36) scale(.82)">{inner}</g>
  </>
);

const renders: Record<ArtKind, (a: string, b: string, c: string, id: string, text?: string) => JSX.Element> = {
  pyramids: (a, b, c) => poster(Pyramids(a, b, c), "#F7F4EE"),
  karnak: (a, b, c) =>
    poster(
      <g>
        <rect width="400" height="500" fill={b} />
        <rect y="40" width="400" height="34" fill={c} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${22 + i * 76} 74)`}>
            <path d="M0 0 H56 Q50 40 44 50 H12 Q6 40 0 0 Z" fill={a} />
            <rect x="12" y="50" width="32" height="330" fill={a} />
            {[0, 1, 2, 3].map((k) => <rect key={k} x="12" y={120 + k * 60} width="32" height="5" fill={c} opacity=".5" />)}
            <rect x="4" y="380" width="48" height="16" fill={c} />
          </g>
        ))}
        <rect y="470" width="400" height="30" fill={c} />
      </g>, "#F7F4EE"),
  nile: (a, b, c) =>
    poster(
      <g>
        <rect width="400" height="500" fill={a} />
        <path d="M200 500 C180 420 240 380 210 300 C185 235 230 190 200 140" stroke={b} strokeWidth="10" fill="none" strokeLinecap="round" />
        {[-150, -100, -50, 0, 50, 100, 150].map((dx, i) => (
          <path key={i} d={`M200 140 Q${200 + dx * 0.4} 90 ${200 + dx} 40`} stroke={i === 3 ? c : b} strokeWidth={i === 3 ? 7 : 4} fill="none" strokeLinecap="round" />
        ))}
        <circle cx="210" cy="300" r="9" fill={c} />
        <circle cx="200" cy="470" r="9" fill={c} />
        <text x="226" y="306" fill={b} fontSize="15" fontFamily="system-ui, sans-serif">Cairo</text>
        <text x="216" y="476" fill={b} fontSize="15" fontFamily="system-ui, sans-serif">Aswan</text>
      </g>, "#F7F4EE"),
  hieroglyph: (a, b, c) =>
    poster(
      <g>
        <rect width="400" height="500" fill={a} />
        {Array.from({ length: 12 }).map((_, i) => {
          const x = 40 + (i % 3) * 120, y = 40 + Math.floor(i / 3) * 112;
          const g = [
            <circle cx="40" cy="40" r="22" fill="none" stroke={c} strokeWidth="7" />,
            <path d="M6 40 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10" stroke={b} strokeWidth="6" fill="none" />,
            <path d="M40 74 V26 M40 26 Q40 8 56 4 Q52 18 40 26 Z" stroke={c} strokeWidth="6" fill={c} strokeLinejoin="round" strokeLinecap="round" />,
            <path d="M12 60 Q40 0 68 60 Z" fill={b} />,
            <g><circle cx="40" cy="24" r="14" fill="none" stroke={c} strokeWidth="6" /><path d="M40 38 v36 M22 50 h36" stroke={c} strokeWidth="6" /></g>,
            <path d="M8 40 Q40 14 72 40 Q40 66 8 40 Z M40 40 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" fill={b} fillRule="evenodd" />,
          ][i % 6];
          return <g key={i} transform={`translate(${x} ${y})`}><rect width="80" height="80" fill="none" />{g}</g>;
        })}
      </g>, "#F7F4EE"),
  sun: (a, b, c) =>
    poster(
      <g>
        <rect width="400" height="500" fill={c} />
        <circle cx="200" cy="200" r="58" fill={a} />
        <path d="M140 200 C90 170 40 175 10 150 C60 205 100 215 140 214 Z" fill={a} />
        <path d="M260 200 C310 170 360 175 390 150 C340 205 300 215 260 214 Z" fill={a} />
        <path d="M0 360 Q100 310 200 350 T400 330 V500 H0 Z" fill={b} opacity=".55" />
        <path d="M0 410 Q120 360 240 400 T400 390 V500 H0 Z" fill={b} />
        <path d="M0 450 Q140 420 260 450 T400 440 V500 H0 Z" fill={a} opacity=".4" />
      </g>, "#F7F4EE"),
  abstract: (a, b, c) => (
    <g><rect width="400" height="500" fill={b} /><circle cx="140" cy="180" r="110" fill={a} /><rect x="180" y="240" width="170" height="190" fill={c} /></g>
  ),
  sleeve: (a, b, c) => (
    <g>
      <rect width="400" height="500" fill="#EAE5DC" />
      <ellipse cx="200" cy="420" rx="150" ry="16" fill="#000" opacity=".08" />
      <rect x="58" y="130" width="284" height="280" rx="22" fill={a} />
      <rect x="58" y="130" width="284" height="280" rx="22" fill="none" stroke="#000" strokeOpacity=".06" strokeWidth="2" />
      <rect x="84" y="250" width="232" height="132" rx="14" fill="#000" opacity=".07" />
      <path d="M200 130 V230" stroke={b} strokeWidth="26" />
      <circle cx="200" cy="222" r="9" fill={c} />
      {Array.from({ length: 30 }).map((_, i) => (
        <circle key={i} cx={70 + ((i * 53) % 260)} cy={142 + ((i * 89) % 255)} r="1.4" fill="#fff" opacity=".22" />
      ))}
    </g>
  ),
  flag: (a, b, c, _id, text) => (
    <g>
      <rect width="400" height="500" fill="#E9E3D8" />
      <rect x="62" y="70" width="8" height="390" rx="4" fill={c} />
      <circle cx="66" cy="66" r="10" fill="#B99A5B" />
      <path d="M70 90 C150 70 230 120 340 92 L340 300 C230 328 150 278 70 298 Z" fill={a} />
      <path d="M70 90 C150 70 230 120 340 92 L340 120 C230 148 150 98 70 118 Z" fill="#fff" opacity=".1" />
      <text x="205" y="210" textAnchor="middle" fill={b} fontFamily="system-ui, sans-serif" fontWeight="800" fontSize={text && text.length > 10 ? 26 : 36} >
        {(text || "YOUR TEXT").slice(0, 18).toUpperCase()}
      </text>
    </g>
  ),
  case: (a, b, c, id, text) => (
    <g>
      <rect width="400" height="500" fill="#E9E3D8" />
      <ellipse cx="208" cy="452" rx="120" ry="12" fill="#000" opacity=".08" />
      <g clipPath={`url(#cp${id})`}>
        {a === "#E3DAC9" ? (
          <g>
            <rect x="70" y="60" width="260" height="380" fill={a} />
            <rect x="140" y="170" width="120" height="240" rx="58" fill="none" stroke={c} strokeWidth="6" />
            <path d="M175 400 h50" stroke={c} strokeWidth="6" />
            <circle cx="200" cy="210" r="14" fill="none" stroke={b} strokeWidth="5" />
            <path d="M178 256 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7" stroke={b} strokeWidth="4" fill="none" />
            <path d="M200 285 v40 M186 296 h28" stroke={b} strokeWidth="5" />
            <path d="M180 365 Q200 330 220 365 Z" fill={b} />
          </g>
        ) : (
          <g transform="translate(70 60) scale(.65 .76)">{Pyramids(a, b, c)}</g>
        )}
      </g>
      <rect x="70" y="60" width="260" height="380" rx="44" fill="none" stroke={c} strokeOpacity=".9" strokeWidth="6" />
      <rect x="92" y="82" width="96" height="104" rx="26" fill={c} />
      <circle cx="118" cy="110" r="15" fill="#3a3a3a" stroke="#555" strokeWidth="3" />
      <circle cx="160" cy="110" r="15" fill="#3a3a3a" stroke="#555" strokeWidth="3" />
      <circle cx="118" cy="156" r="15" fill="#3a3a3a" stroke="#555" strokeWidth="3" />
    </g>
  ),
  sunshade: (a, b, c, id) => (
    <g>
      <rect width="400" height="500" fill="#E9E3D8" />
      <g clipPath={`url(#ws${id})`}>
        <g transform="translate(20 40) scale(.9 .75)">{Pyramids(a, b, c)}</g>
        {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${60 + i * 56} 130 L${50 + i * 62} 400`} stroke="#000" strokeOpacity=".07" strokeWidth="2" />)}
      </g>
      <path d="M60 170 Q200 130 340 170 L370 360 Q200 390 30 360 Z" fill="none" stroke={c} strokeWidth="5" />
      <rect x="185" y="150" width="30" height="16" rx="4" fill={c} opacity=".85" />
    </g>
  ),
  umbrella: (a, b, c) => (
    <g>
      <rect width="400" height="500" fill="#E9E3D8" />
      <path d="M40 230 Q200 40 360 230 Z" fill={a} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${40 + i * 80} 230 Q${80 + i * 80} 200 ${120 + i * 80} 230`} fill="#E9E3D8" />
      ))}
      <path d="M200 70 Q160 140 120 230 M200 70 Q240 140 280 230 M200 70 V230" stroke="#000" strokeOpacity=".12" strokeWidth="3" fill="none" />
      <circle cx="200" cy="150" r="22" fill={b} opacity=".9" />
      <rect x="196" y="48" width="8" height="26" rx="3" fill={c} />
      <path d="M200 230 V400 Q200 440 236 440 Q262 440 262 414" stroke="#8B6B43" strokeWidth="12" fill="none" strokeLinecap="round" />
    </g>
  ),
};

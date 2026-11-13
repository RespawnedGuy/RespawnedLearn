// ✦-Marke im Notizbuch (Vertrag Lernen 1.5, 5.3): Antippen öffnet ein kleines Menü „Zum Skript“ und „Marke entfernen“.
// Entfernen nimmt die Marke und ihren Ausschnitt von der Buchseite; die Markierung im Skript bleibt.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Verweis } from "@rl/kern";
import { geheZu, useDaten } from "@rl/oberflaeche";

export function MarkeKnopf({
  verweis: v,
  blinkt,
  style,
  onEntfernen,
}: {
  verweis: Verweis;
  blinkt: boolean;
  style: CSSProperties;
  onEntfernen: () => void;
}) {
  const { bestand } = useDaten();
  const [auf, setAuf] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: PointerEvent) =>
      !ref.current?.contains(e.target as Node) && setAuf(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAuf(false);
    addEventListener("pointerdown", weg, true);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", weg, true);
      removeEventListener("keydown", esc);
    };
  }, [auf]);
  const skript = `${bestand.dokumente.get(v.anhang)?.titel ?? "Skript"}, Seite ${v.seite}`;
  return (
    <div className="marke-huelle" style={style} ref={ref}>
      <button
        type="button"
        className={`verweis aus-markierung${blinkt ? " blinkt" : ""}`}
        title={`Markierung aus ${skript}`}
        aria-haspopup="menu"
        aria-expanded={auf}
        onClick={() => setAuf((a) => !a)}
      >
        ✦ S. {v.seite}
      </button>
      {auf && (
        <div className="schwebe marke-menue" role="menu">
          <button
            type="button"
            role="menuitem"
            className="buch-zeile"
            onClick={() => (
              setAuf(false),
              geheZu("sammeln", v.anhang, v.seite)
            )}
          >
            <span>
              Zum Skript <small>{skript}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="buch-zeile gefahr"
            onClick={() => (setAuf(false), onEntfernen())}
          >
            <span>
              Marke entfernen <small>samt Ausschnitt</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ✦-Marke im Notizbuch (Vertrag Lernen 1.5, 5.3): Antippen öffnet ein kleines Menü „Zum Skript“ und „Marke entfernen“.
// Entfernen nimmt die Marke und ihren Ausschnitt von der Buchseite; die Markierung im Skript bleibt. Mit dem Radierer
// entfernt Halten (1 s, ablaufender Kreis) die Marke ohne Menü (Nils 2026-11-15); das Menü bleibt für die Tastatur.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LOESCHEN_MS, type Verweis } from "@rl/kern";
import { geheZu, useDaten, useHalten } from "@rl/oberflaeche";

export function MarkeKnopf({
  verweis: v,
  blinkt,
  style,
  radierer = false,
  onEntfernen,
}: {
  verweis: Verweis;
  blinkt: boolean;
  style: CSSProperties;
  /** Werkzeug Radierer: Halten entfernt */
  radierer?: boolean;
  onEntfernen: () => void;
}) {
  const { bestand } = useDaten();
  const [auf, setAuf] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const halten = useHalten({ dauer: LOESCHEN_MS, art: "loeschen", aktiv: radierer, stiftRadierer: true, onFertig: onEntfernen });
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
        className={`verweis aus-markierung${blinkt ? " blinkt" : ""}${halten.laeuft ? " loescht-gleich" : ""}`}
        title={radierer ? `Markierung aus ${skript}. Halten entfernt Marke und Ausschnitt` : `Markierung aus ${skript}`}
        aria-haspopup="menu"
        aria-expanded={auf}
        onClick={() => !radierer && setAuf((a) => !a)}
        {...halten.griffe}
      >
        ✦ S. {v.seite}
        {halten.ring}
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

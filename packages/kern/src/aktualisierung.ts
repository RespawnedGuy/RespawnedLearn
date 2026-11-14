// Neue Versionen der App (docs/aktualisieren.md) und die Vertragsmarke im Datenordner (Vertrag Lernen 1.6, 8).
// Rein: liest die Datei `latest.json` aus dem neuesten GitHub-Release (dasselbe Format, das der Tauri-Updater liest,
// gebaut von tools/neueste.mjs, Testtabelle testdaten/latest.json) und vergleicht Versionen.

/** Feste Adresse des neuesten Releases; GitHub leitet auf die Datei des jeweils neuesten Releases weiter */
export const NEUESTE_ADRESSE = 'https://github.com/RespawnedGuy/RespawnedLearn/releases/latest/download/latest.json'

/** Nur dorthin öffnet die App einen Download (Android): Releases dieses Repos */
const DOWNLOAD_ANFANG = 'https://github.com/RespawnedGuy/RespawnedLearn/releases/download/'

export type Plattform = 'windows' | 'android'

export interface Neuigkeit {
  version: string
  notizen: string
  datum: string | null
  /** Datei für diese Plattform (Android: die APK zum Herunterladen); null, wenn der Release keine hat */
  adresse: string | null
}

/** Schlüssel in `platforms`, in der Reihenfolge, in der sie gelten (Tauri: `<os>-<arch>-<installer>` vor `<os>-<arch>`) */
export const PLATTFORM_SCHLUESSEL: Record<Plattform, string[]> = {
  windows: ['windows-x86_64-nsis', 'windows-x86_64-msi', 'windows-x86_64'],
  android: ['android-aarch64']
}

const teile = (v: string) => {
  const [kern, vorab] = v.trim().replace(/^v/, '').split('-', 2) as [string, string | undefined]
  return { zahlen: kern.split('.').map((z) => (/^\d+$/.test(z) ? Number(z) : NaN)), vorab }
}

/** Gültige Version: Zahlen mit Punkten (0.20.0, auch Vertrag 1.6), optional `-beta.1` */
export function istVersion(v: unknown): v is string {
  return typeof v === 'string' && /^v?\d+(\.\d+){1,2}(-[0-9A-Za-z.]+)?$/.test(v.trim())
}

/** < 0: a älter, 0: gleich, > 0: a neuer. Fehlende Stellen zählen als 0, eine Vorabversion ist älter als ohne. */
export function vergleicheVersionen(a: string, b: string): number {
  const x = teile(a)
  const y = teile(b)
  for (let i = 0; i < Math.max(x.zahlen.length, y.zahlen.length); i++) {
    const d = (x.zahlen[i] ?? 0) - (y.zahlen[i] ?? 0)
    if (d) return Math.sign(d)
  }
  if (x.vorab === y.vorab) return 0
  if (x.vorab === undefined) return 1
  if (y.vorab === undefined) return -1
  return x.vorab < y.vorab ? -1 : 1
}

export function erlaubterDownload(adresse: string): boolean {
  return adresse.startsWith(DOWNLOAD_ANFANG) && !adresse.includes('..') && !/[\s?#]/.test(adresse)
}

/** Liest `latest.json`; null, wenn die Datei nicht passt (dann sagt die App nichts, statt Unsinn anzuzeigen) */
export function liesNeuigkeit(text: string, plattform: Plattform): Neuigkeit | null {
  let roh: unknown
  try {
    roh = JSON.parse(text)
  } catch {
    return null
  }
  if (!roh || typeof roh !== 'object') return null
  const r = roh as { version?: unknown; notes?: unknown; pub_date?: unknown; platforms?: unknown }
  if (!istVersion(r.version)) return null
  const plattformen = r.platforms && typeof r.platforms === 'object' ? (r.platforms as Record<string, { url?: unknown }>) : {}
  const eintrag = PLATTFORM_SCHLUESSEL[plattform].map((s) => plattformen[s]).find((e) => e && typeof e.url === 'string')
  const adresse = eintrag && erlaubterDownload(eintrag.url as string) ? (eintrag.url as string) : null
  return {
    version: r.version.trim().replace(/^v/, ''),
    notizen: typeof r.notes === 'string' ? r.notes.trim().slice(0, 2000) : '',
    datum: typeof r.pub_date === 'string' && !Number.isNaN(Date.parse(r.pub_date)) ? r.pub_date : null,
    adresse
  }
}

/** Gibt es etwas zu zeigen? Nur eine neuere Version, die nicht schon weggeklickt wurde. */
export function zeigeNeuigkeit(n: Neuigkeit | null, eigene: string, weggeklickt: string | null): boolean {
  return !!n && vergleicheVersionen(n.version, eigene) > 0 && n.version !== weggeklickt
}

// ── Vertragsmarke (Vertrag Lernen 1.6, 8) ────────────────────────────────────────────────────────────────────────

/** Vertragsversion, nach der diese App liest und schreibt */
export const VERTRAG = '1.10'
export const VERTRAG_PFAD = 'lernen/vertrag.json'

/** Immer derselbe Text für dieselbe Version: schreiben zwei Geräte gleichzeitig, ist der Inhalt gleich */
export function vertragText(version: string = VERTRAG): string {
  return `{"vertrag": "${version}"}\n`
}

export function liesVertrag(text: string | undefined): string | null {
  if (!text) return null
  try {
    const v = (JSON.parse(text) as { vertrag?: unknown }).vertrag
    return istVersion(v) ? v.trim() : null
  } catch {
    return null
  }
}

export type VertragsSchritt =
  | { art: 'gut' }
  /** Marke fehlt oder ist älter: die App schreibt ihre Version (nur nach oben, nie herunter) */
  | { art: 'schreiben'; text: string }
  /** Ein anderes Gerät mit neuerer App hat den Ordner schon auf einen neueren Vertrag gehoben */
  | { art: 'neuer'; gefunden: string }

/** Was die App mit der Marke tun soll. Unlesbare Marke: nichts schreiben (meist halb übertragen), nichts melden. */
export function vertragsSchritt(text: string | undefined, eigen: string = VERTRAG): VertragsSchritt {
  if (text === undefined) return { art: 'schreiben', text: vertragText(eigen) }
  const gefunden = liesVertrag(text)
  if (gefunden === null) return { art: 'gut' }
  const d = vergleicheVersionen(gefunden, eigen)
  if (d > 0) return { art: 'neuer', gefunden }
  if (d < 0) return { art: 'schreiben', text: vertragText(eigen) }
  return { art: 'gut' }
}

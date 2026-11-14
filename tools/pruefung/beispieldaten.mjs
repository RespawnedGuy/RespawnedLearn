// Legt einen Datenordner mit erfundenen Beispieldaten an (zum Ausprobieren und für Tests).
// Aufruf: node tools/beispieldaten.mjs [zielordner]   (Standard: ./daten)
// Echte Daten gehören nie ins Repository; dieser Ordner steht in .gitignore.
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import path from 'node:path'

const ziel = path.resolve(process.argv[2] || 'daten')
const heute = new Date()
const zwei = (n) => String(n).padStart(2, '0')
const tag = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
const vor = (n) => tag(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - n))
const zeit = (t) => `${t}T08:00:00+02:00`
const H = tag(heute)
const jm = `${H.slice(0, 4)}/${H.slice(5, 7)}`

async function schreibe(rel, inhalt) {
  const abs = path.join(ziel, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, inhalt)
}

const kopf = (felder) =>
  '---\n' +
  Object.entries(felder)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' && /^\[\[|: /.test(v) ? JSON.stringify(v) : v}`)
    .join('\n') +
  '\n---\n'

// ---------- winziger PDF-Schreiber: Linien, Rechtecke, Text ----------
function pdf(seiten, breite = 842, hoehe = 595) {
  const objekte = []
  const add = (s) => objekte.push(s) // Objektnummer = Index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // Pages, unten gefüllt
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const kinder = []
  for (const inhalt of seiten) {
    const strom = Buffer.from(inhalt, 'latin1')
    add(`<< /Length ${strom.length} >>\nstream\n${inhalt}\nendstream`)
    const inhaltNr = objekte.length
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${breite} ${hoehe}] /Contents ${inhaltNr} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`)
    kinder.push(`${objekte.length} 0 R`)
  }
  objekte[1] = `<< /Type /Pages /Kids [${kinder.join(' ')}] /Count ${kinder.length} >>`
  let out = '%PDF-1.4\n'
  const versatz = []
  objekte.forEach((o, i) => {
    versatz.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${versatz.map((v) => `${String(v).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
const text = (x, y, s, g = 11) => `BT /F1 ${g} Tf ${x} ${y} Td (${s.replace(/[()\\]/g, '\\$&')}) Tj ET\n`
const rechteck = (x, y, b, h, w = 2) => `${w} w ${x} ${y} ${b} ${h} re S\n`
const linie = (x1, y1, x2, y2, w = 1) => `${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`

function grundriss(titel, raeume) {
  let s = rechteck(40, 40, 762, 515, 4)
  for (const [x, y, b, h, name] of raeume) s += rechteck(x, y, b, h, 2) + text(x + 10, y + h - 20, name, 10)
  s += text(40, 565, titel, 14) + linie(600, 60, 780, 60, 0.5) + text(600, 66, 'Massstab 1:100', 8)
  return s
}

const eg = pdf([
  grundriss('EG Grundriss', [
    [40, 300, 260, 255, 'Empfang'],
    [300, 300, 220, 255, 'Buero 1.01'],
    [520, 300, 282, 255, 'Besprechung'],
    [40, 40, 200, 260, 'Technik / Datenschrank'],
    [240, 40, 300, 260, 'Flur'],
    [540, 40, 262, 260, 'Lager']
  ])
])
const og = pdf([
  grundriss('OG Grundriss', [
    [40, 300, 380, 255, 'Grossraumbuero'],
    [420, 300, 382, 255, 'Kueche'],
    [40, 40, 762, 260, 'Archiv']
  ])
])
const schema = pdf([
  `${text(40, 565, 'BMA Linienschema', 14)}${rechteck(60, 380, 140, 120, 2)}${text(90, 435, 'BMZ HF-3000')}` +
    [1, 2, 3, 4].map((i) => linie(200, 520 - i * 30, 760, 520 - i * 30, 1.5) + text(720, 524 - i * 30, `Linie ${i}`, 9)).join('')
])
const skript = pdf(
  [
    `${text(60, 760, '2.3 Elektrische Spannung', 18)}${text(60, 720, 'Die Spannung zwischen zwei Punkten ist die Arbeit, die je Ladung')}${text(60, 704, 'beim Verschieben zwischen diesen Punkten verrichtet wird.')}${text(250, 650, 'U = W / Q', 22)}${text(60, 600, 'Die Einheit der Spannung ist das Volt. Ein Volt liegt an, wenn fuer eine')}${text(60, 584, 'Ladung von einem Coulomb eine Arbeit von einem Joule noetig ist.')}`,
    `${text(60, 760, '2.4 Elementarladung', 18)}${text(60, 720, 'Kleinste frei vorkommende Ladung: e = 1,602 * 10^-19 C')}${text(250, 660, 'Q = n * e', 22)}`
  ],
  595,
  842
)

const sha = (b) => createHash('sha256').update(b).digest('hex')
const anhang = async (id, name, inhalt, felder) => {
  const datei = `anhaenge/${jm}/${id.slice(-6).toLowerCase()}-${name}`
  await schreibe(datei, inhalt)
  await schreibe(
    `gemeinsam/anhaenge/${id}.md`,
    kopf({ id, typ: 'anhang', erstellt: zeit(vor(3)), geaendert: zeit(vor(3)), titel: name.replace(/\.pdf$/, ''), datei, sha256: sha(inhalt), veraenderlich: true, mime: 'application/pdf', geraet: 'beispiel', ...felder })
  )
}

// Zwei erfundene Fotos (schlichte PNGs): eins mit Name und Beschreibung, eins ohne (Kachel zeigt dann „Foto“)
function png(b, h, farbe) {
  const crc = (buf) => {
    let c = ~0
    for (const x of buf) {
      c ^= x
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const teil = (typ, daten) => {
    const t = Buffer.concat([Buffer.from(typ), daten])
    const z = Buffer.alloc(8 + daten.length + 4)
    z.writeUInt32BE(daten.length, 0)
    t.copy(z, 4)
    z.writeUInt32BE(crc(t), 8 + daten.length)
    return z
  }
  const kopfdaten = Buffer.alloc(13)
  kopfdaten.writeUInt32BE(b, 0)
  kopfdaten.writeUInt32BE(h, 4)
  kopfdaten.set([8, 2, 0, 0, 0], 8)
  const roh = Buffer.alloc((b * 3 + 1) * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < b; x++) {
      const hell = 0.6 + 0.4 * (y / h) - (Math.abs(x - b / 2) < b / 6 && Math.abs(y - h / 2) < h / 5 ? 0.35 : 0)
      roh.set(farbe.map((c) => Math.round(c * hell)), y * (b * 3 + 1) + 1 + x * 3)
    }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), teil('IHDR', kopfdaten), teil('IDAT', deflateSync(roh)), teil('IEND', Buffer.alloc(0))])
}
const foto = async (id, name, inhalt, felder = {}) => {
  const datei = `anhaenge/${jm}/${id.slice(-6).toLowerCase()}-${name}`
  await schreibe(datei, inhalt)
  await schreibe(
    `gemeinsam/anhaenge/${id}.md`,
    kopf({ id, typ: 'anhang', erstellt: zeit(vor(1)), geaendert: zeit(vor(1)), titel: name.replace(/\.png$/, ''), datei, sha256: sha(inhalt), veraenderlich: false, mime: 'image/png', geraet: 'beispiel', ...felder })
  )
}
await foto('01JBEISPIEL000000000FOTO01', 'IMG_2041.png', png(160, 220, [235, 230, 222]), { name: 'Lichtschalter Flur', beschreibung: JSON.stringify('Ausgang 9 invertiert,\nGLT rot/schwarz ist Licht') })
await foto('01JBEISPIEL000000000FOTO02', 'IMG_2042.png', png(220, 160, [200, 60, 50]))

const P = '01JBEISPIEL0000000PROJEKT1'
const P2 = '01JBEISPIEL0000000PROJEKT2'
await schreibe('arbeit/projekte/dd_os_76.md', kopf({ id: P, typ: 'projekt', erstellt: zeit(vor(20)), geaendert: zeit(vor(20)), titel: 'Bürohaus Oststraße 76', kuerzel: 'dd_os_76', status: 'aktiv', adresse: 'Oststraße 76, 01099 Dresden', start: vor(20) }) + '\nBMA-Umbau und Mängelbeseitigung.\n')
await schreibe('arbeit/projekte/haus.md', kopf({ id: P2, typ: 'projekt', erstellt: zeit(vor(40)), geaendert: zeit(vor(40)), titel: 'Haus', kuerzel: 'haus', status: 'aktiv', tags: ['privat'] }))
await anhang('01JBEISPIEL00000000PLANEG1', 'EG Grundriss.pdf', eg, { projekt: `[[${P}]]`, art: 'plan' })
await anhang('01JBEISPIEL00000000PLANOG1', 'OG Grundriss.pdf', og, { projekt: `[[${P}]]`, art: 'plan' })
await anhang('01JBEISPIEL00000000PLANBMA', 'BMA Linienschema.pdf', schema, { projekt: `[[${P}]]`, art: 'plan' })
await anhang('01JBEISPIEL0000000SKRIPET1', 'Skript ET1.pdf', skript, {})
await schreibe(
  'arbeit/markierungen/01JBEISPIEL00000000PLANEG1.md',
  kopf({ id: '01JBEISPIEL0000000MARKEN01', typ: 'markierungen', erstellt: zeit(vor(2)), geaendert: zeit(vor(2)), titel: 'Stellen in EG Grundriss', anhang: '[[01JBEISPIEL00000000PLANEG1]]' }) +
    `- S. 1 · Datenschrank fehlt %%rn 0.060 0.470 0.230 0.420 ${vor(2)} wichtig%% ^a7k2c9\n`
)

const journal = (d, rumpf) =>
  schreibe(`arbeit/journal/${d.slice(0, 4)}/${d}.md`, kopf({ id: `01JBEISPIELJOURNAL${d.replace(/-/g, '')}`, typ: 'journal', erstellt: zeit(d), geaendert: zeit(d), titel: `Journal ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`, datum: d }) + rumpf)

await journal(
  vor(2),
  `# Allgemein
Rückruf Lieferant wegen Meldern, @Sabine Krause meldet sich.

# #dd_os_76
## Begehung EG
- [ ] Datenschrank fehlt ![[01JBEISPIEL00000000PLANEG1#seite=1&marke=a7k2c9|EG Grundriss, S. 1]]
Brandschutzklappe im Flur geprüft, ok.
`
)
await journal(
  vor(1),
  `# #dd_os_76
## Mängelanzeige
### Mangel 1 - blockiert
Linie 4 weiterhin kaputt
> [!blockade] Ersatzmodul fehlt
> Wenn: Lieferung vom Großhandel da
> Dann: Linie 4 neu auflegen und messen
> Prüfen: ${vor(-3)}

### Mangel 2 - erledigt
- [x] Melder 3/12 getauscht
![[01JBEISPIEL000000000FOTO01|Foto]] ![[01JBEISPIEL000000000FOTO02|Foto]]

# #haus
- [ ] Dachrinne reinigen
`
)

await schreibe(
  'arbeit/vorlagen/01JBEISPIEL000000VORLAGE1.md',
  kopf({ id: '01JBEISPIEL000000VORLAGE1', typ: 'vorlage', erstellt: zeit(vor(5)), geaendert: zeit(vor(5)), titel: 'Mängelanzeige' }) +
    '## Mängelanzeige\n### Mangel 1{{cursor}}\n- [ ] Foto\n- [ ] Ort im Plan\n'
)
await schreibe(
  'arbeit/vorlagen/01JBEISPIEL000000VORLAGE2.md',
  kopf({ id: '01JBEISPIEL000000VORLAGE2', typ: 'vorlage', erstellt: zeit(vor(5)), geaendert: zeit(vor(5)), titel: 'Wartung BMA' }) +
    '## Wartung BMA {{datum}}\n- [ ] Akkus prüfen\n- [ ] Melder auslösen (Stichprobe)\n- [ ] Prüfbuch eintragen\n'
)
await schreibe(
  'arbeit/vorlagen/01JBEISPIEL000000VORLAGE3.md',
  kopf({ id: '01JBEISPIEL000000VORLAGE3', typ: 'vorlage', erstellt: zeit(vor(5)), geaendert: zeit(vor(5)), titel: 'Inbetriebnahme BMA', art: 'bericht' }) +
    '### Inbetriebnahme\n- Zentrale einschalten\n- Linien prüfen\n- [ ] Revisionsbuch dabei\n\n### Messprotokolle #danach\n| Messwert | Messung |\n|---|---|\n| Linie 1 | |\n'
)

// Kontakte: so legt der Server das Abbild aus Outlook ab (erfundene Personen)
await schreibe(
  'gemeinsam/kontakte/outlook.vcf',
  [
    ['Sabine Krause', 'Krause;Sabine', 'Elektrogroßhandel Nord', 'Innendienst', 'TEL;TYPE=CELL:+49 170 0000001', 'EMAIL;TYPE=INTERNET:s.krause@beispiel.invalid'],
    ['Tom Becker', 'Becker;Tom', 'Bauleitung Ost GmbH', 'Bauleiter', 'TEL;TYPE=WORK:0351 0000002', 'EMAIL;TYPE=INTERNET:t.becker@beispiel.invalid']
  ]
    .map(([fn, n, org, titel, tel, mail], i) => `BEGIN:VCARD\r\nVERSION:3.0\r\nUID:beispiel-${i + 1}\r\nFN:${fn}\r\nN:${n};;;\r\nORG:${org}\r\nTITLE:${titel}\r\n${tel}\r\n${mail}\r\nEND:VCARD\r\n`)
    .join('')
)

// NocoDB: Beteiligte mit Rolle in der vCard, Projektadressen als eigenes Abbild
await schreibe(
  'gemeinsam/kontakte/nocodb.vcf',
  'BEGIN:VCARD\r\nVERSION:3.0\r\nUID:1\r\nFN:Petra Planer\r\nN:Planer;Petra;;;\r\nORG:Planungsbüro West\r\nTEL;TYPE=CELL:+49 170 0000003\r\nX-RVX-PROJEKT:dd_os_76;Fachplanerin\r\nX-RVX-PROJEKT:haus;Architektin\r\nEND:VCARD\r\n'
)
await schreibe('gemeinsam/kontakte/nocodb-projekte.json', JSON.stringify([{ kuerzel: 'haus', titel: 'Haus', adresse: 'Gartenweg 3, 01309 Dresden' }], null, 2) + '\n')

// Aufgaben mit Fristen und Abhängigkeiten (Gantt und Netzplan im Bereich Organisation)
const aufgabe = (id, f) => schreibe(`arbeit/aufgaben/${id}.md`, kopf({ id, typ: 'aufgabe', erstellt: zeit(vor(3)), geaendert: zeit(vor(3)), status: 'offen', projekt: `[[${P}]]`, ...f }))
await aufgabe('01JBEISPIEL0000000AUFGABE1', { titel: 'Kabeltrasse EG verlegen', faellig: vor(-5) })
await aufgabe('01JBEISPIEL0000000AUFGABE2', { titel: 'Melder montieren', blockiert_durch: ['"[[01JBEISPIEL0000000AUFGABE1]]"'] })
await aufgabe('01JBEISPIEL0000000AUFGABE3', { titel: 'Prüfbuch anlegen' })
await aufgabe('01JBEISPIEL0000000AUFGABE4', { titel: 'Abnahme mit Sachverständigem', faellig: vor(-18), blockiert_durch: ['"[[01JBEISPIEL0000000AUFGABE2]]"', '"[[01JBEISPIEL0000000AUFGABE3]]"'] })
// lange unberührt: erscheinen unter Zuordnen > Noch relevant?
await aufgabe('01JBEISPIEL0000000AUFGABE5', { titel: 'Restmaterial zurückschicken', erstellt: zeit(vor(64)), geaendert: zeit(vor(64)) })
await aufgabe('01JBEISPIEL0000000AUFGABE6', { titel: 'Dachrinne reinigen', erstellt: zeit(vor(41)), geaendert: zeit(vor(41)), projekt: `[[${P2}]]` })

// Kalender: so legt der Server das Abbild aus einem iCal-Link ab (Bereich Organisation)
const nach = (n) => vor(-n)
await schreibe(
  'gemeinsam/kalender/familie.json',
  JSON.stringify(
    {
      name: 'Familie',
      termine: [
        { uid: 'b1', titel: 'Elternabend Klasse 3b', beginn: `${H}T19:00`, ende: `${H}T20:30`, ganztags: false, ort: 'Grundschule', notiz: '' },
        { uid: 'b2', titel: 'Kuchenbasar, Kuchen mitbringen', beginn: nach(2), ende: nach(2), ganztags: true, ort: '', notiz: 'Bitte bis 8 Uhr abgeben.' },
        { uid: 'b3', titel: 'Herbstferien', beginn: nach(4), ende: nach(8), ganztags: true, ort: '', notiz: '' }
      ]
    },
    null,
    2
  ) + '\n'
)
await schreibe(
  'gemeinsam/kalender/arbeit.json',
  JSON.stringify(
    {
      name: 'Arbeit',
      termine: [
        { uid: 'a1', titel: 'Baubesprechung Rathaus', beginn: `${nach(1)}T09:00`, ende: `${nach(1)}T10:30`, ganztags: false, ort: 'Baucontainer', notiz: '' },
        { uid: 'a2', titel: 'Jour fixe', beginn: `${nach(3)}T08:00`, ende: `${nach(3)}T08:30`, ganztags: false, ort: 'Teams', notiz: '' }
      ]
    },
    null,
    2
  ) + '\n'
)

// Lernen
const karte = (id, f, rumpf) => schreibe(`lernen/karten/${id}.md`, kopf({ id, erstellt: zeit(vor(9)), geaendert: zeit(vor(9)), ...f }) + rumpf)
await karte('01JBEISPIEL0000KARTEELADNG', { typ: 'erklaerung', titel: 'Elementarladung', quelle: '[[01JBEISPIEL0000000SKRIPET1]]', aliase: ['e'] }, 'Kleinste frei vorkommende Ladung. Jede Ladung ist ein ganzzahliges Vielfaches davon. Ein Elektron trägt −e, ein Proton +e.\n\n$$e \\approx 1{,}602 \\cdot 10^{-19}\\,\\mathrm{C}$$\n\nVerknüpft: [[01JBEISPIEL0000KARTESPANNG|Spannung]] (Ladung wird verschoben)\n')
await karte('01JBEISPIEL0000KARTESPANNG', { typ: 'erklaerung', titel: 'Spannung', quelle: '[[01JBEISPIEL0000000SKRIPET1]]', aliase: ['Spannungsteiler'] }, 'Arbeit pro Ladung beim Verschieben zwischen zwei Punkten. Wie ein Höhenunterschied beim Wasser.\n\n$$U = \\frac{W}{Q}$$\n')
await karte('01JBEISPIEL0000KARTEFRAGE1', { typ: 'frage', titel: 'Wie groß ist die Elementarladung?', thema: '[[01JBEISPIEL0000KARTEELADNG]]' }, '?? Wie groß ist die Elementarladung?\n:: e ≈ 1,602 · 10⁻¹⁹ C\n')
await karte('01JBEISPIEL0000KARTEFRAGE2', { typ: 'frage', titel: 'Was ist Spannung?', thema: '[[01JBEISPIEL0000KARTESPANNG]]' }, '?? Was ist elektrische Spannung?\n:: Die Arbeit je Ladung beim Verschieben zwischen zwei Punkten, U = W / Q.\n')

// Lehrgang ohne Skript: Modul mit Mitschrift, Lernkarten zeigen auf Stellen darin (Vertrag 5.3, Mitschrift)
await schreibe('lernen/module/01JBEISPIEL0000MODULRUF01.md', kopf({ id: '01JBEISPIEL0000MODULRUF01', typ: 'modul', erstellt: zeit(vor(12)), geaendert: zeit(vor(12)), titel: 'Fachkraft für Rufanlagen', ziel: 'Lehrgang Rufanlagen nach DIN VDE 0834', favorit: true, quellen: [], termin: vor(-21) }))
await karte(
  '01JBEISPIEL0000MITSCHRIFT1',
  { typ: 'notiz', titel: 'Mitschrift Tag 1', thema: '[[01JBEISPIEL0000MODULRUF01]]' },
  `## Mitschrift

### Norm
DIN VDE 0834 Teil 1: Geräteanforderungen, Planen, Errichten und Betrieb.
Teil 2: Umweltbedingungen und elektromagnetische Verträglichkeit.

> [!NOTE] Normaktualität
> Geprüft wird immer nach der aktuellen Norm.

### Grundlagen
#### Grundfunktionen der Rufanlage
- Hilfe jederzeit rufen können
- Rufe eindeutig, ortsbezogen, optisch und akustisch signalisieren
- Anlage überwacht sich selbst und meldet Störungen sofort ^ruf001

### Apparatur
#### Ruftaster
- rot, mindestens 1 cm²
- Bildzeichen, Findelicht, Beruhigungslampe ^ruf002

#### Zimmersignalleuchten
- rotes und grünes Leuchtfeld
- erkennbar aus 20 m bei 500 lx Umgebung
- Ruf innerhalb 1 s angezeigt ^ruf003

### Planung
- an jedem Bett ein rufauslösendes Element
- Zugschnur neben das WC, nicht dahinter
`
)
await karte('01JBEISPIEL0000KARTERUF001', { typ: 'frage', titel: 'Was muss eine Rufanlage mit Störungen tun?', thema: '[[01JBEISPIEL0000MODULRUF01]]', stelle: '[[01JBEISPIEL0000MITSCHRIFT1#^ruf001]]' }, '?? Was muss eine Rufanlage mit Störungen tun?\n:: Sich selbst überwachen und Störungen dem Personal sofort melden.\n')
await karte('01JBEISPIEL0000KARTERUF002', { typ: 'frage', titel: 'Welche Lichter hat ein Ruftaster?', thema: '[[01JBEISPIEL0000MODULRUF01]]', stelle: '[[01JBEISPIEL0000MITSCHRIFT1#^ruf002]]' }, '?? Welche Lichter hat ein Ruftaster?\n:: Findelicht (Nachtfindbarkeit) und Beruhigungslampe (Rückmeldung).\n')
await karte('01JBEISPIEL0000KARTERUF003', { typ: 'frage', titel: 'Wie gut muss eine Zimmersignalleuchte erkennbar sein?', thema: '[[01JBEISPIEL0000MODULRUF01]]', stelle: '[[01JBEISPIEL0000MITSCHRIFT1#^ruf003]]' }, '?? Wie gut muss eine Zimmersignalleuchte erkennbar sein?\n:: Aus 20 m bei 500 lx Umgebung; der Ruf erscheint innerhalb 1 s.\n')

// Studienmodul mit Umfang, Termin, Lernzeit und eigenen Einheiten (Vertrag Lernen 1.7)
await schreibe(
  'lernen/module/01JBEISPIEL0000MODULET1001.md',
  kopf({ id: '01JBEISPIEL0000MODULET1001', typ: 'modul', erstellt: zeit(vor(30)), geaendert: zeit(vor(1)), titel: 'Elektrotechnik 1', ziel: 'Klausur im Februar', quellen: ['"[[01JBEISPIEL0000000SKRIPET1]]"'], ects: 5, termin: vor(-70), stundenProWoche: 6 }) +
    '\n## Lernplan\n- [ ] S. 1: Einheit Volt = Joule je Coulomb\n- [x] S. 2: Elementarladung e ≈ 1,602 · 10⁻¹⁹ C\n'
)
await schreibe('lernen/inhalt/01JBEISPIEL0000000SKRIPET1.json', JSON.stringify({ herkunft: 'pdf', version: 1, kapitel: [{ titel: '2.3 Elektrische Spannung', seite: 1, ebene: 1 }, { titel: '2.4 Elementarladung', seite: 2, ebene: 1 }] }))
await schreibe(
  `lernen/zeit/${vor(2).slice(0, 7)}.beispiel.jsonl`,
  [3, 2, 1].map((n) => JSON.stringify({ ziel: '01JBEISPIEL0000MODULET1001', art: 'sammeln', am: `${vor(n)}T08:00:00.000Z`, bis: `${vor(n)}T09:15:00.000Z`, quelle: '01JBEISPIEL0000000SKRIPET1', seiten: [1, 1] })).join('\n') + '\n'
)

console.log(`Beispieldaten in ${ziel}`)

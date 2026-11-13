/**
 * Wie pdf.js Dateien öffnet. Skripte aus PDFs ausführen kann pdf.js im Kern nicht; Schriften baut es aber per eval
 * nach, wenn es darf (Ursache von CVE-2024-4367). Die CSP der App verbietet eval ohnehin; das hier ist die zweite Schicht.
 */
export const PDF_LADEN = { isEvalSupported: false } as const

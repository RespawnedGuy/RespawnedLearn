// Design-Prüfung W9: Unter Android erst erklären, dann „Zugriff auf alle Dateien“ anfragen.
import { describe, expect, it } from 'vitest'
import { startSchritt } from '../src/ersterStart'

describe('startSchritt', () => {
  it('PC und Browser (keine Brücke): erst Ordner, dann App', () => {
    expect(startSchritt(null, null)).toBe('ordner')
    expect(startSchritt(null, 'D:/Lernen')).toBe('app')
  })
  it('Android ohne Zugriff: zuerst die Erklärung, auch ohne Ordner', () => {
    expect(startSchritt(false, null)).toBe('erlaubnis')
  })
  it('Android mit Zugriff: Ordnerwahl, dann App', () => {
    expect(startSchritt(true, null)).toBe('ordner')
    expect(startSchritt(true, '/storage/emulated/0/RespawnedLearn')).toBe('app')
  })
  it('Zugriff später entzogen: Erklärung statt App', () => {
    expect(startSchritt(false, '/storage/emulated/0/RespawnedLearn')).toBe('erlaubnis')
  })
})

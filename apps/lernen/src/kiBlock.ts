// Erklären (Vertrag 5.8): Verlauf des Chatfensters und wie er auf einer Wissenskarte landet. Ohne Browser, damit testbar.

export interface ChatZeile {
  von: 'ich' | 'ki'
  text: string
}

/** Verlauf als eingeklappter Block für die Wissenskarte (Vertrag 5.5): die KI-Worte bleiben von den eigenen getrennt */
export function kiBlock(verlauf: ChatZeile[], datum: string): string {
  const zeilen = [`> [!ki]- Erklärung der KI vom ${datum}`]
  verlauf.forEach((v, i) => {
    if (i > 0) zeilen.push('>')
    const text = v.von === 'ich' ? `Rückfrage: ${v.text.trim()}` : v.text.trim()
    for (const z of text.split('\n')) zeilen.push(z.trim() ? `> ${z}` : '>')
  })
  return zeilen.join('\n')
}


# ComplianceHub - Build & Runtime Error Tracker

Dieses Dokument dient der systematischen Erfassung und Behebung von Fehlern, die während des Docker-Builds (Prerendering) oder zur Laufzeit auftreten.

## 🔴 In Bearbeitung (Build-Blocker)

Keine aktuellen Build-Blocker bekannt.

## 🟢 Behoben (Build-Stabilität)

| ID | Fehler | Ort | Ursache | Lösung | Status |
|:---|:---|:---|:---|:---|:---|
| ERR-01 | `ReferenceError: Save is not defined` | `/settings/sync` | Namenskollision oder fehlender Import | Umbenennung in `SaveIcon` | ✅ Behoben |
| ERR-02 | `ReferenceError: Switch is not defined` | `/settings/email` | Fehlender Import der Switch-Komponente | Import hinzugefügt | ✅ Behoben |
| ERR-03 | `Parsing ecmascript failed` | `/processhub/view/[id]` | Nicht geschlossene Tags (`SelectContent`) | JSX-Struktur validiert & bereinigt | ✅ Behoben |
| ERR-04 | `ReferenceError: ArrowUp is not defined` | `/processhub/view/[id]` | Fehlende Imports für Historien-Icons | `ArrowUp`, `ArrowDown`, `FileJson` hinzugefügt | ✅ Behoben |

## 🛡️ Richtlinien für Entwickler

1. **Icons**: Lucide Icons immer mit Alias importieren, falls Namensgleichheit mit Funktionen besteht: `import { Save as SaveIcon } from 'lucide-react'`.
2. **Prerendering**: Next.js 15 validiert alle Codepfade beim Build. Variablen müssen auch in inaktiven Tabs (`TabsContent`) definiert sein.
3. **Client-Hooks**: `isMounted` Check für Komponenten verwenden, die auf dem Server anders initialisiert werden könnten (Hydrierungsschutz).

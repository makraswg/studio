
# ComplianceHub - Build & Runtime Error Tracker

Dieses Dokument dient der systematischen Erfassung und Behebung von Fehlern, die während des Docker-Builds (Prerendering) oder zur Laufzeit auftreten.

## 🔴 In Bearbeitung (Build-Blocker)

Keine aktuellen Build-Blocker bekannt.

## 🟢 Behoben (Build-Stabilität)

| ID | Fehler | Ort | Ursache | Lösung | Status |
|:---|:---|:---|:---|:---|:---|
| ERR-01 | `ReferenceError: Save is not defined` | `/settings/sync`, `/risks`, `/gdpr` | Namenskollision mit `handleSave` | Umbenennung in `SaveIcon` | ✅ Behoben |
| ERR-02 | `ReferenceError: Switch is not defined` | `/settings/email`, `/settings/sync` | Fehlender Import | Import hinzugefügt | ✅ Behoben |
| ERR-03 | `Parsing ecmascript failed` | `/processhub/view/[id]` | Nicht geschlossene Tags / Schachtelung | JSX-Struktur validiert & bereinigt | ✅ Behoben |
| ERR-04 | `Unexpected token ... Did you mean {'}'}?` | `/processhub/view/[id]` | Fehlender `</SelectContent>` Abschluss | Tag korrekt geschlossen | ✅ Behoben |
| ERR-05 | `Internal Server Error` | Global | Malformed JSX in Kernkomponenten | Syntaxbereinigung in Prozessansicht | ✅ Behoben |

## 🛡️ Richtlinien für Entwickler

1. **Icons**: Lucide Icons immer mit Alias importieren, falls Namensgleichheit mit Funktionen besteht: `import { Save as SaveIcon } from 'lucide-react'`.
2. **Prerendering**: Next.js 15 validiert alle Codepfade beim Build. Variablen müssen auch in inaktiven Tabs definiert sein.
3. **Schachtelung**: Immer prüfen, ob ShadCN-Komponenten (Select, Dialog) vollständig geschlossen sind.

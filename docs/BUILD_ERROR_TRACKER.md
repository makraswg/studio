
# ComplianceHub - Build & Runtime Error Tracker

Dieses Dokument dient der systematischen Erfassung und Behebung von Fehlern, die während des Docker-Builds (Prerendering) oder zur Laufzeit auftreten.

## 🟢 Behoben (Build-Stabilität)

| ID | Fehler | Ort | Ursache | Lösung |
|:---|:---|:---|:---|:---|
| ERR-01 | `ReferenceError: Save is not defined` | `/settings/sync`, `/settings/email`, `/risks`, `/features`, `/gdpr` | Icon `Save` kollidierte mit Funktionsnamen oder fehlte | Importiert als `SaveIcon` |
| ERR-02 | `ReferenceError: Switch is not defined` | `/settings/email`, `/settings/sync` | Fehlender Import der Shadcn Switch Komponente | Import hinzugefügt |
| ERR-03 | `ReferenceError: ArrowDown is not defined` | `/processhub/view/[id]` | Fehlender Import in der Versionshistorie | Icon zur Importliste hinzugefügt |
| ERR-04 | `Parsing ecmascript failed` (JSX) | `/processhub/view/[id]` | Falsch geschachtelte `div` oder ungeschlossene Tags | JSX-Struktur bereinigt & validiert |
| ERR-05 | `Hydration Mismatch` | `Select` Komponenten | Instabile IDs bei SSR in Next.js 15 | `suppressHydrationWarning` und Mount-Check |
| ERR-06 | `ReferenceError: Target is not defined` | `/processhub/view/[id]` | Doppelte oder fehlende Target-Icons | Importe bereinigt und eindeutig benannt |
| ERR-07 | `ReferenceError: ArrowRightLeft is not defined` | `/processhub/view/[id]` | Fehlender Import für das Schnittstellen-Icon | Icon importiert |
| ERR-08 | `ReferenceError: ArrowUp is not defined` | `/processhub/view/[id]` | Fehlender Import für das Start-Icon | Icon importiert |

## 🛡️ Richtlinien für Entwickler

1. **Icons**: Lucide Icons immer mit Alias importieren, falls Namensgleichheit mit Funktionen besteht: `import { Save as SaveIcon } from 'lucide-react'`.
2. **Prerendering**: Next.js 15 validiert alle Codepfade beim Build. Variablen müssen auch in inaktiven Tabs (`TabsContent`) definiert sein.
3. **Client-Hooks**: `useUser` oder `useSettings` erst nach `useEffect` (isMounted) für Logik nutzen, die das initiale HTML beeinflusst.

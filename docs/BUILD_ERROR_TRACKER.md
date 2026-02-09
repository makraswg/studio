
# ComplianceHub - Build & Runtime Error Tracker

Dieses Dokument dient der systematischen Erfassung und Behebung von Fehlern, die während des Docker-Builds (Prerendering) oder zur Laufzeit auftreten.

## 🟢 Behoben (Build-Stabilität)

| ID | Fehler | Ort | Ursache | Lösung |
|:---|:---|:---|:---|:---|
| ERR-01 | `ReferenceError: Save is not defined` | `/settings/sync` | Icon `Save` kollidierte mit Funktionsnamen oder fehlte | Importiert als `SaveIcon` |
| ERR-02 | `ReferenceError: Switch is not defined` | `/settings/email` | Fehlender Import der Shadcn Switch Komponente | Import hinzugefügt |
| ERR-03 | `ReferenceError: ArrowDown is not defined` | `/processhub/view/[id]` | Fehlender Import in der Versionshistorie | Icon zur Importliste hinzugefügt |
| ERR-04 | `Parsing ecmascript failed` (JSX) | `/processhub/view/[id]` | Falsch geschachtelte `div` oder ungeschlossene Tags | JSX-Struktur bereinigt & validiert |
| ERR-05 | `Hydration Mismatch` | `Select` Komponenten | Instabile IDs bei SSR in Next.js 15 | `suppressHydrationWarning` und Mount-Check |
| ERR-06 | `ReferenceError: Save is not defined` | `/features`, `/gdpr` | Namenskollision zwischen Icon und `handleSave` | Umbenannt in `SaveIcon` |

## 🟡 In Prüfung

- [ ] Validierung der PDF-Generierung in der Alpine-Umgebung (Docker).
- [ ] Prüfung der LDAP-Konnektivität im isolierten Docker-Netzwerk.

## 🛡️ Richtlinien für Entwickler

1. **Icons**: Lucide Icons immer mit Alias importieren, falls Namensgleichheit mit Funktionen besteht: `import { Save as SaveIcon } from 'lucide-react'`.
2. **Prerendering**: Next.js 15 validiert alle Codepfade beim Build. Variablen müssen auch in inaktiven Tabs (`TabsContent`) definiert sein.
3. **Client-Hooks**: `useUser` oder `useSettings` erst nach `useEffect` (isMounted) für Logik nutzen, die das initiale HTML beeinflusst.

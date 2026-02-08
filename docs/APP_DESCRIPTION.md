# AccessHub - Master Backlog & Strategisches Manifest (V2.5)

**Rolle**: Dieses Dokument ist das zentrale Steuerungs-Instrument. Es spiegelt den aktuellen Stand nach der GRC-Integration wider.

---

## 🎯 Die Vision: "Integrierte Resilienz"
AccessHub vernetzt alle Governance-Disziplinen. Ein Risiko ist kein einsamer Eintrag, sondern der Startpunkt einer Kette:
`Risiko -> Kontrolle (TOM) -> IT-System -> Geschäftsprozess -> DSGVO-Zweck`.
Die Sensibilität eines IT-Systems leitet sich dabei zwingend aus den darauf gespeicherten Daten (Features) ab.

---

## ✅ Abgeschlossene Meilensteine (Audit-Safe)
*   **GRC-Kern-Vernetzung**: Vollständige Koppelung von Risiken, Maßnahmen, Prozessen und VVTs.
*   **Grafische Landkarte**: Die "Golden Chain" Visualisierung aller Abhängigkeiten.
*   **RBAC-Blueprint**: Stellenbeschreibungen sind direkt mit Standard-Berechtigungen verknüpft.
*   **KI-Audit & Advisor**: Automatisierte Prüfung von Identitäten und Risikoszenarien.
*   **Asset-Detailtiefe (Phase 1.1/1.2)**: Detailseiten für Ressourcen inklusive Impact-Analyse (Reverse-Lookup).

---

## 🏗️ Nächste Ausbaustufen (Priorisierte Roadmap)

### Phase 1: Asset-Intelligence (Höchste Priorität)
*Zweck: IT-Systeme basierend auf der tatsächlichen Datenlast bewerten.*

*   **Aufgabe 1.3: Daten-basierte Kritikalitäts-Vererbung**: 
    *   Implementierung einer Logik, die die Kritikalität und CIA-Anforderungen einer Ressource automatisch aus dem "Maximum-Prinzip" der verknüpften Datenobjekte (Features) ableitet.
    *   *Beispiel*: Wenn ein "Feature" mit Vertraulichkeit "HIGH" im SAP gespeichert ist, muss das SAP-System zwingend "HIGH" erben.
*   **Aufgabe 1.4: KI-Compliance-Validator**: KI-Check, ob die manuell gesetzten Schutzbedarfe der Ressource mit der tatsächlichen Datenlast und der Unternehmensbeschreibung korrelieren.

### Phase 2: Lifecycle & Synchronisation
*Zweck: Automatisierung der operativen Abläufe.*

*   **Aufgabe 2.1: Blueprint-Provisionierung**: Umsetzung der automatischen Zuweisungserstellung im Lifecycle-Hub basierend auf dem Stellenplan-Blueprint.
*   **Aufgabe 2.2: LDAP-Drift-Detection**: Warnung, wenn die Gruppenmitgliedschaften im AD nicht mehr mit den Blueprints im Hub übereinstimmen.
*   **Aufgabe 2.3: Dry-Run Preview**: Vorschau der Auswirkungen eines Sync-Laufs vor der tatsächlichen Änderung der Datenbank.

### Phase 3: Prozess-Resilienz & Monitoring
*Zweck: Echtzeit-Überwachung der Compliance-Gesundheit.*

*   **Aufgabe 3.1: Compliance-Health Dashboard**: Ein globales Widget, das zeigt: "Wie viel Prozent meiner TOMs sind aktuell effektiv?".
*   **Aufgabe 3.2: Automatisierte Rezertifizierungs-Trigger**: Automatisches Starten von Access-Reviews, wenn ein Mitarbeiter die Stelle (und damit den Blueprint) wechselt.

---
*Stand: Februar 2024 - Fokus auf datengetriebene Governance.*

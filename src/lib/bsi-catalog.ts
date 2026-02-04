
export interface BsiModule {
  id: string;
  title: string;
  category: string;
  threats: BsiThreat[];
}

export interface BsiThreat {
  id: string;
  title: string;
  description: string;
}

export const BSI_CATALOG: BsiModule[] = [
  {
    id: 'ISMS',
    title: 'Sicherheitsmanagement',
    category: 'IT-Sicherheit',
    threats: [
      { id: 'ISMS.1', title: 'Fehlende oder unzureichende Sicherheitsstrategie', description: 'Ohne eine klare Strategie werden Sicherheitsmaßnahmen oft nur reaktiv und lückenhaft umgesetzt.' },
      { id: 'ISMS.2', title: 'Unzureichende Ressourcen für Informationssicherheit', description: 'Mangel an Personal oder Budget führt dazu, dass notwendige Kontrollen vernachlässigt werden.' }
    ]
  },
  {
    id: 'ORP',
    title: 'Organisation und Personal',
    category: 'Betrieblich',
    threats: [
      { id: 'ORP.1', title: 'Fehlende Vertretungsregelungen', description: 'Ausfall von Schlüsselpersonen führt zu Stillstand in kritischen IT-Prozessen.' },
      { id: 'ORP.2', title: 'Unzureichende Sensibilisierung der Mitarbeiter', description: 'Mitarbeiter erkennen Social-Engineering-Angriffe oder Phishing nicht.' }
    ]
  },
  {
    id: 'CON',
    title: 'Konzeption und Vorgehensweise',
    category: 'Rechtlich',
    threats: [
      { id: 'CON.1', title: 'Unzureichendes Identitäts- und Berechtigungsmanagement', description: 'Benutzer verfügen über mehr Rechte als für ihre Aufgabe notwendig (Verstoß gegen Least Privilege).' },
      { id: 'CON.2', title: 'Fehlendes oder lückenhaftes Backup-Konzept', description: 'Datenverlust kann nicht oder nur sehr zeitverzögernd behoben werden.' }
    ]
  },
  {
    id: 'OPS',
    title: 'IT-Betrieb',
    category: 'Betrieblich',
    threats: [
      { id: 'OPS.1', title: 'Veraltete Softwarestände (Patch-Management)', description: 'Sicherheitslücken in Betriebssystemen oder Anwendungen werden nicht zeitnah geschlossen.' },
      { id: 'OPS.2', title: 'Unzureichende Protokollierung von Ereignissen', description: 'Sicherheitsvorfälle werden nicht erkannt, da relevante Logs fehlen oder nicht ausgewertet werden.' }
    ]
  },
  {
    id: 'SYS',
    title: 'IT-Systeme',
    category: 'IT-Sicherheit',
    threats: [
      { id: 'SYS.1', title: 'Fehlerhafte Konfiguration von Servern', description: 'Standard-Passwörter oder unnötige Dienste erhöhen die Angriffsfläche massiv.' },
      { id: 'SYS.2', title: 'Nutzung nicht freigegebener IT (Shadow IT)', description: 'Einsatz von Cloud-Diensten oder Hardware ohne Wissen der IT-Sicherheit.' }
    ]
  },
  {
    id: 'APP',
    title: 'Anwendungen',
    category: 'Datenschutz',
    threats: [
      { id: 'APP.1', title: 'Fehlende Verschlüsselung bei der Datenübertragung', description: 'Sensible Daten können im Netzwerk im Klartext mitgelesen werden.' },
      { id: 'APP.2', title: 'Mangelhafte Trennung von Test- und Produktivdaten', description: 'Echte personenbezogene Daten werden in unsicheren Testumgebungen genutzt.' }
    ]
  },
  {
    id: 'NET',
    title: 'Netze und Kommunikation',
    category: 'IT-Sicherheit',
    threats: [
      { id: 'NET.1', title: 'Unzureichende Segmentierung des Netzwerks', description: 'Angreifer können sich nach einem Einbruch ungehindert im gesamten Netz ausbreiten (Lateral Movement).' },
      { id: 'NET.2', title: 'Unsichere Anbindung von Außenstellen oder Home-Office', description: 'Schwache VPN-Konfigurationen oder fehlende MFA beim Fernzugriff.' }
    ]
  }
];

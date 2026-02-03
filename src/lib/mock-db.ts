
// Dies ist eine einfache Mock-Datenbank für Entwicklungs- und Testzwecke.

const mockData: { [key: string]: any[] } = {
  assignments: [
    { id: 'mock-assign-1', user: 'Max Mustermann (Mock)', resource: 'Projekt Alpha (Mock)', role: 'Editor', status: 'active' },
    { id: 'mock-assign-2', user: 'Erika Mustermann (Mock)', resource: 'Marketing Drive (Mock)', role: 'Viewer', status: 'pending' },
  ],
  users: [
    { id: 'mock-user-1', name: 'Max Mustermann (Mock)', email: 'max.mock@example.com', created_at: '2023-01-15' },
    { id: 'mock-user-2', name: 'Erika Mustermann (Mock)', email: 'erika.mock@example.com', created_at: '2023-02-20' },
  ],
  resources: [
      { id: 'mock-res-1', name: 'Projekt Alpha (Mock)', type: 'gcs', path: 'gs://projekt-alpha' },
      { id: 'mock-res-2', name: 'Marketing Drive (Mock)', type: 'drive', path: 'shared-drive/marketing' },
  ],
  roles: [
      { id: 'mock-role-1', name: 'Administrator (Mock)', description: 'Voller Zugriff auf alle Ressourcen.' },
      { id: 'mock-role-2', name: 'Editor (Mock)', description: 'Kann Ressourcen erstellen und bearbeiten.' },
  ],
  groups: [
      { id: 'mock-group-1', name: 'Entwickler (Mock)', members: 5 },
      { id: 'mock-group-2', name: 'Marketing (Mock)', members: 10 },
  ]
};

// Simuliert das Abrufen einer Kollektion
export const getMockCollection = (collectionName: string): any[] => {
  console.log(`[Mock DB] Abrufen der Kollektion: ${collectionName}`);
  return mockData[collectionName] || [];
};

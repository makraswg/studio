
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SettingsProvider } from '@/context/settings-context';
import { AuthProvider } from '@/context/auth-context';

export const metadata: Metadata = {
  title: 'ComplianceHub - Mandantenfähige Berechtigungsregistrierung',
  description: 'Verwalten Sie den IT-Zugriff und die Berechtigungen für Ihre gesamte Organisation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-primary-foreground">
        <SettingsProvider>
          <AuthProvider>
            <FirebaseClientProvider { /* @ts-ignore */ ...{} }>
              {children}
              <Toaster />
            </FirebaseClientProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Users, 
  Shield, 
  Mail, 
  Plus, 
  Save, 
  Trash2,
  Lock,
  Globe,
  Bell,
  Database
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SettingsPage() {
  const [tenantName, setTenantName] = useState('Acme Corp');
  const [tenantSlug, setTenantSlug] = useState('acme');
  const { dataSource, setDataSource } = useSettings();

  const handleSave = () => {
    toast({ title: "Einstellungen gespeichert", description: "Ihre Änderungen wurden erfolgreich gespeichert." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Mandanteneinstellungen</h1>
        <p className="text-muted-foreground mt-1">Konfigurieren Sie die ComplianceHub-Umgebung Ihrer Organisation.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-xl">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 gap-2">
            <Settings className="w-4 h-4" /> Allgemein
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 gap-2">
            <Database className="w-4 h-4" /> Datenquelle
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 gap-2">
            <Users className="w-4 h-4" /> Mitglieder & Rollen
          </TabsTrigger>
          <TabsTrigger value="ldap" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 gap-2">
            <Globe className="w-4 h-4" /> LDAP-Konfiguration
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 gap-2">
            <Lock className="w-4 h-4" /> Sicherheit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
              <CardDescription>Stammdaten Ihres Mandanten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name der Organisation</Label>
                  <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mandanten-Slug (URL)</Label>
                  <Input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Speichern</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Datenquellen-Konfiguration</CardTitle>
              <CardDescription>Wählen Sie die primäre Datenbank für die Anwendung aus. Eine Änderung erfordert einen Neustart der App.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={dataSource} onValueChange={(value) => setDataSource(value as any)}>
                <Label className="flex items-center gap-4 p-4 rounded-xl border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all">
                  <RadioGroupItem value="firestore" id="firestore" />
                  <Database className="w-6 h-6 text-primary"/>
                  <div>
                    <p className="font-bold">Google Firestore</p>
                    <p className="text-sm text-muted-foreground">Skalierbare NoSQL-Cloud-Datenbank. Ideal für die meisten Anwendungsfälle.</p>
                  </div>
                </Label>
                <Label className="flex items-center gap-4 p-4 rounded-xl border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all">
                  <RadioGroupItem value="mock" id="mock" />
                  <Database className="w-6 h-6 text-muted-foreground"/>
                  <div>
                    <p className="font-bold">Mock-Datenbank</p>
                    <p className="text-sm text-muted-foreground">Lokale Beispieldaten. Nützlich für Entwicklung und Tests ohne Cloud-Verbindung.</p>
                  </div>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <Card className="border-none shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mitgliederverwaltung</CardTitle>
                <CardDescription>Administratoren mit Zugriff auf diese Konsole.</CardDescription>
              </div>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Einladen</Button>
            </CardHeader>
            <CardContent>
               <div className="border rounded-lg divide-y">
                 {[
                   { name: 'Admin User', email: 'admin@company.com', role: 'Super Admin' },
                   { name: 'Security Officer', email: 'security@company.com', role: 'Auditor' }
                 ].map(m => (
                   <div key={m.email} className="flex items-center justify-between p-4">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">{m.name.charAt(0)}</div>
                       <div>
                         <p className="text-sm font-bold">{m.name}</p>
                         <p className="text-xs text-muted-foreground">{m.email}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-3">
                       <Badge variant="outline">{m.role}</Badge>
                       <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                     </div>
                   </div>
                 ))}
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ldap" className="space-y-6">
           <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Active Directory / LDAP</CardTitle>
              <CardDescription>Automatischer Import von Benutzern und Gruppen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between p-4 border rounded-xl">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-primary/10 rounded-lg text-primary"><Globe className="w-5 h-5" /></div>
                   <div>
                     <p className="font-bold">LDAP Synchronisierung</p>
                     <p className="text-xs text-muted-foreground">Benutzer werden alle 24h automatisch abgeglichen.</p>
                   </div>
                 </div>
                 <Switch checked />
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Sicherheitseinstellungen</CardTitle>
              <CardDescription>Review-Intervalle und MFA-Erzwingung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="space-y-0.5">
                     <Label>MFA für Admins erzwingen</Label>
                     <p className="text-xs text-muted-foreground">Alle Administratoren müssen 2FA verwenden.</p>
                   </div>
                   <Switch checked />
                 </div>
                 <div className="flex items-center justify-between">
                   <div className="space-y-0.5">
                     <Label>Audit-Log Versiegelung</Label>
                     <p className="text-xs text-muted-foreground">Protokolle können nicht manuell gelöscht werden.</p>
                   </div>
                   <Switch checked />
                 </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Tenant } from "@/lib/types";

interface AdWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Partial<Tenant>;
  onSave: (tenant: Partial<Tenant>) => void;
}

export function AdWizard({ open, onOpenChange, tenant, onSave }: AdWizardProps) {
  const [step, setStep] = useState(1);
  const [localTenant, setLocalTenant] = useState<Partial<Tenant>>(tenant);
  const [isTesting, setIsTesting] = useState(false);

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSave = () => {
    onSave(localTenant);
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h3 className="font-bold">Step 1: Connect to AD Server</h3>
            <div className="space-y-4 mt-4">
              <div>
                <Label>LDAP Server URL</Label>
                <Input
                  value={localTenant.ldapUrl || ""}
                  onChange={(e) =>
                    setLocalTenant({ ...localTenant, ldapUrl: e.target.value })
                  }
                  placeholder="ldap://dc.example.com"
                />
              </div>
              <div>
                <Label>Bind DN</Label>
                <Input
                  value={localTenant.ldapBindDn || ""}
                  onChange={(e) =>
                    setLocalTenant({ ...localTenant, ldapBindDn: e.target.value })
                  }
                  placeholder="cn=administrator,cn=users,dc=example,dc=com"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={localTenant.ldapBindPassword || ""}
                  onChange={(e) =>
                    setLocalTenant({
                      ...localTenant,
                      ldapBindPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
            <div>
                <h3>Step 2: Configure User Search</h3>
                <div className="space-y-4 mt-4">
                    <div>
                        <Label>Base DN</Label>
                        <Input 
                            value={localTenant.ldapBaseDn || ''} 
                            onChange={e => setLocalTenant({...localTenant, ldapBaseDn: e.target.value})} 
                            placeholder="OU=Users,DC=firma,DC=local"
                        />
                    </div>
                    <div>
                        <Label>User Filter</Label>
                        <Input 
                            value={localTenant.ldapUserFilter || ''} 
                            onChange={e => setLocalTenant({...localTenant, ldapUserFilter: e.target.value})} 
                            placeholder="(objectClass=user)"
                        />
                    </div>
                </div>
            </div>
        );
      case 3:
        return (
          <div>
            <h3 className="font-bold">Step 3: Attribute Mapping</h3>
            <p className="text-sm text-gray-500 mb-4">Map AD attributes to application fields.</p>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Username</Label>
                    <Input 
                        value={localTenant.ldapAttrUsername || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrUsername: e.target.value})}
                        placeholder="sAMAccountName"
                    />
                </div>
                <div>
                    <Label>First Name</Label>
                    <Input 
                        value={localTenant.ldapAttrFirstname || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrFirstname: e.target.value})}
                        placeholder="givenName"
                    />
                </div>
                <div>
                    <Label>Last Name</Label>
                    <Input
                        value={localTenant.ldapAttrLastname || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrLastname: e.target.value})}
                        placeholder="sn"
                    />
                </div>
                <div>
                    <Label>Email</Label>
                    <Input
                        value={localTenant.ldapAttrEmail || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrEmail: e.target.value})}
                        placeholder="mail"
                    />
                </div>
                <div>
                    <Label>Groups</Label>
                    <Input
                        value={localTenant.ldapAttrGroups || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrGroups: e.target.value})}
                        placeholder="memberOf"
                    />
                </div>
                 <div>
                    <Label>Department</Label>
                    <Input
                        value={localTenant.ldapAttrDepartment || ''}
                        onChange={e => setLocalTenant({...localTenant, ldapAttrDepartment: e.target.value})}
                        placeholder="department"
                    />
                </div>
            </div>
          </div>
        );
      case 4:
          return (
              <div>
                  <h3 className="font-bold">Step 4: Review and Save</h3>
                  <p>Please review your settings before saving.</p>
              </div>
          )
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Active Directory Setup Wizard</DialogTitle>
          <DialogDescription>
            Step {step} of 4
          </DialogDescription>
        </DialogHeader>
        <div className="p-6">{renderStep()}</div>
        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>}
          {step < 4 && <Button onClick={handleNext}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>}
          {step === 4 && <Button onClick={handleSave}>Save Configuration</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

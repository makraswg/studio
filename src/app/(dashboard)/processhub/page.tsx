<<<<<<< HEAD
import ProcessHubClientWrapper from './ProcessHubClientWrapper';

export default function ProcessHubPage() {
  return <ProcessHubClientWrapper />;
=======
"use client";

import { Suspense } from 'react';
import ProcessHubClient from './ProcessHubClient';
import { Loader2 } from 'lucide-react';

export default function ProcessHubPage() {
  return (
    <Suspense fallback={<div className="flex w-full h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>}>
      <ProcessHubClient />
    </Suspense>
  )
>>>>>>> 9cb2b10 (in der listenansicht soll im interen bereich der box stehen welche proze)
}

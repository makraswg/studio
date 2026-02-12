import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ProcessHubClient = dynamic(() => import('./ProcessHubClient'), {
  ssr: false,
  loading: () => <div className="flex w-full h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>
});

export default function ProcessHubPage() {
  return <ProcessHubClient />;
}

import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { ConnectForm } from './ConnectForm';

export const metadata: Metadata = { title: 'Database connection' };

export default function ConnectPage() {
  return (
    <AuthScreen subtitle="Connect to your Supabase database">
      <ConnectForm />
    </AuthScreen>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthScreen subtitle="Flying Blue XP, trips and spending">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}

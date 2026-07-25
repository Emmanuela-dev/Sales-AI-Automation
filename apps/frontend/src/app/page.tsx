import { redirect } from 'next/navigation';

// Root redirect → dashboard (auth handled by middleware)
export default function RootPage() {
  redirect('/dashboard');
}

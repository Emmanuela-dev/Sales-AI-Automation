// Auth pages don't use the dashboard layout
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

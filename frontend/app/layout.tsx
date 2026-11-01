import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Atlas — Research workspace',
  description:
    'A research workspace for source-backed answers, connected documents, and clearer thinking.',
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

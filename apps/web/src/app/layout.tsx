import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DON | Digital Operations Navigator',
  description: 'Secure, Advanced, Multi-Device AI Assistant',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-don-bg text-don-text antialiased selection:bg-amber-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}

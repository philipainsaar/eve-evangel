import './globals.css';

export const metadata = {
  title: 'Three.js MP4 Background',
  description: 'Next.js + Three.js looping MP4 background',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import './globals.css';

export const metadata = {
  title: '//ĒVĒ//',
  description: 'Evangelion',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

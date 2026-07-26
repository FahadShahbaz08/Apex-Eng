import "./globals.css";

export const metadata = {
  title: "Apex Engineering — Manufacturing ERP",
  description: "Expandable manufacturing, inventory, production and accounting ERP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

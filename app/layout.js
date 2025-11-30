import "./globals.css";

export const metadata = {
  title: "Netrex",
  description: " Sınırsız sesli sohbet ve metin iletişimi için tasarlanmıştır.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white overflow-hidden">{children}</body>
    </html>
  );
}

import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Netrex Client",
  description: " Sınırsız sesli sohbet ve metin iletişimi için tasarlanmıştır.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

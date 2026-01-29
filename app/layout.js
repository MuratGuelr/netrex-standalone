import "./globals.css";
import { Providers } from "./providers";
import ErrorBoundary from "@/src/components/ui/ErrorBoundary";

export const metadata = {
  title: "Netrex | Güvenli Sesli Sohbet",
  description: "Sınırsız sesli sohbet ve metin iletişimi için tasarlanmış premium masaüstü uygulaması.",
  keywords: "sesli sohbet, voice chat, discord alternatifi, güvenli iletişim",
  authors: [{ name: "Netrex Team" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-nds-bg-primary text-nds-text-primary overflow-hidden antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

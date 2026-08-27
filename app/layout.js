import "./globals.css";
import { Providers } from "./providers";
import ErrorBoundary from "@/src/components/ui/ErrorBoundary";

export const metadata = {
  title: "Netrex | Güvenli Sesli Sohbet",
  description: "Sınırsız sesli sohbet ve metin iletişimi için tasarlanmış premium masaüstü uygulaması.",
  keywords: "sesli sohbet, voice chat, discord alternatifi, güvenli iletişim",
  authors: [{ name: "Netrex Team" }],
  // 🌐 Mobile PWA Meta Tags
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: "#0a0a0c",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Netrex",
  },
  formatDetection: {
    telephone: false,
  },
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

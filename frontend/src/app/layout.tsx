import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/brand";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Lead Management & Sales CRM | Synentrix Technologies`,
  description:
    `${PRODUCT_NAME} by Synentrix Technologies Pvt. Ltd. — India's modern lead management and sales CRM platform. Capture leads, manage pipelines, track deals, and close faster.`,
  keywords: [
    "lead management",
    "CRM software",
    "sales pipeline",
    "Synentrix",
    "Synentrix Flow",
    "India",
    "Salesforce alternative",
    "sales CRM",
  ],
  openGraph: {
    title: `${PRODUCT_NAME} — Lead Management & Sales CRM`,
    description:
      "Capture leads, manage pipelines, track deals, and forecast revenue — by Synentrix Technologies Pvt. Ltd.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

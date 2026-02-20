import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bruce IT Onboarding",
  description: "Oriol Healthcare new hire onboarding tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <Header />
        <Toaster position="top-center" />
        {children}
      </body>
    </html>
  );
}

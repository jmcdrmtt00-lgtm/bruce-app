import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import Header from "@/components/Header";
import { DemoProvider } from "@/contexts/DemoContext";
import DemoController from "@/components/DemoController";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Buddy",
  description: "Oriol Healthcare new hire onboarding tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DemoProvider>
          <Header />
          <Toaster position="top-center" toastOptions={{ duration: 8000 }} />
          {children}
          <DemoController />
        </DemoProvider>
      </body>
    </html>
  );
}

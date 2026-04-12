import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata = {
  title: "Email Drafts — Olagunjua Real Estate",
  description: "Daily cold email drafts for Abdul-Samad Olagunju",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

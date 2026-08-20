import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automovia",
  description: "B2B SaaS — passwordless auth with Clerk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#07090c] font-sans text-zinc-100 antialiased">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: { colorPrimary: "#2dd4bf" },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

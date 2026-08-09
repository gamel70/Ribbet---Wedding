import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";

// Display + UI faces from the design tokens in README.md. Cormorant Garamond and
// Libre Caslon Text join these when the layout picker lands.
const karla = Karla({ variable: "--font-karla", subsets: ["latin"], weight: ["400", "700", "800"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ribbet",
  description: "Your wedding, in your own Google account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${karla.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

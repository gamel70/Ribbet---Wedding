import type { Metadata } from "next";
import { Cormorant_Garamond, Fraunces, Karla, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";

// Display + UI faces from the design tokens in README.md. Karla is the UI face;
// the three serifs are the display faces, one per layout, and the intake's live
// preview switches between them as the couple picks.
const karla = Karla({ variable: "--font-karla", subsets: ["latin"], weight: ["400", "700", "800"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});
const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Ribbet",
  description: "Your wedding, in your own Google account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${karla.variable} ${fraunces.variable} ${cormorant.variable} ${libreCaslon.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

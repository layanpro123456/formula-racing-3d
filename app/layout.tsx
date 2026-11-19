import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formula Racing 3D",
  description: "A browser-based 3D formula racing prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

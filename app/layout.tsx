import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formula Racing 3D — WebGL Motorsport Simulator",
  description: "High-performance browser-based 3D Formula motorsport simulator built with Next.js 14, Babylon.js, Havok Physics WASM, procedural 3D tracks, autonomous AI grid, dynamic particle effects, and real-time race commentary.",
  icons: {
    icon: "/logo.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

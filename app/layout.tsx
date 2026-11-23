import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://layanpro123456.github.io/formula-racing-3d"),
  title: "Formula Racing 3D — WebGL Motorsport Simulator",
  description: "High-performance browser-based 3D Formula motorsport simulator built with Next.js 14, Babylon.js, Havok Physics WASM, procedural 3D tracks, autonomous AI grid, dynamic particle effects, and real-time race commentary.",
  icons: {
    icon: "logo.svg"
  },
  openGraph: {
    title: "Formula Racing 3D — WebGL Motorsport Simulator",
    description: "High-performance browser-based 3D Formula motorsport simulator built with Next.js 14, Babylon.js, Havok Physics WASM, procedural 3D tracks, and autonomous AI grid.",
    url: "https://layanpro123456.github.io/formula-racing-3d/",
    siteName: "Formula Racing 3D",
    images: [
      {
        url: "social_preview.jpg",
        width: 1200,
        height: 675,
        alt: "Formula Racing 3D Cinematic Showcase Banner",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Formula Racing 3D — WebGL Motorsport Simulator",
    description: "High-performance browser-based 3D Formula motorsport simulator built with Next.js 14, Babylon.js, and Havok Physics WASM.",
    images: ["social_preview.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5eee5",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://tableqr-menu-rebuild.belugaremodeling.chatgpt.site"),
  title: "Chai N Pani — Order Indian & Indo-Chinese Food",
  description: "Explore Chai N Pani's menu of Indian mains, Indo-Chinese favourites, quick bites, rice, biryani, drinks and desserts.",
  openGraph: {
    title: "Chai N Pani — Order Indian & Indo-Chinese Food",
    description: "Indian mains, Indo-Chinese favourites, quick bites, rice, biryani, drinks and desserts.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 628, alt: "Chai N Pani Indian and Indo-Chinese menu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chai N Pani — Order Indian & Indo-Chinese Food",
    description: "Indian mains, Indo-Chinese favourites, quick bites, rice, biryani, drinks and desserts.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

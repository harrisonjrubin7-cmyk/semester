import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata = { title: "Course Engine", description: "Verified course knowledge workspace" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}

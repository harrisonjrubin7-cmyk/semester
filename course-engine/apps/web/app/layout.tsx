import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata = { title: "Semester · Course workspace", description: "Source-aware course planning and study workspace" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}

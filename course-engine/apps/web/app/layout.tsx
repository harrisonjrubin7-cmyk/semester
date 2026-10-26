import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata = { title: "Semester OS", description: "The connected operating system for learning and institutions" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}

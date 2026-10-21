import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobbid — Your next chapter",
  description: "Your private workspace for job applications, tailored resumes, and what comes next.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('jobbid-theme')||'dark'}catch{}" }} />{children}</body>
    </html>
  );
}

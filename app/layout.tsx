import type { Metadata } from "next";
import "./globals.css";
import "./profile.css";
import "./activity.css";

export const metadata: Metadata = {
  title: "All in one place-job support",
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

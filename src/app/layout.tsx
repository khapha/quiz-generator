import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "QuizBank — Ngân hàng câu hỏi trắc nghiệm",
  description:
    "Ôn tập với các bộ câu hỏi trắc nghiệm sinh từ tài liệu học tập, kèm giải thích chi tiết cho từng câu.",
};

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <BookIcon />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-800">QuizBank</p>
              <p className="text-[11px] text-slate-500">Trắc nghiệm ôn tập</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 justify-center px-4 py-8">{children}</div>
        <footer className="border-t border-slate-200/70 py-5 text-center text-xs text-slate-400">
          Bộ câu hỏi sinh tự động bằng AI từ tài liệu học tập · Dùng để ôn tập tham khảo
        </footer>
      </body>
    </html>
  );
}

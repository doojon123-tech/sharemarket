import "./globals.css";
export const metadata = { title: "쉐어마켓", description: "우리 동네 학생 공동구매" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ko"><body className="mx-auto max-w-md min-h-screen bg-gray-50 text-gray-900">{children}</body></html>);
}

import { Header } from "@/components/layout/Header"
import { ConditionalFooter } from "@/components/layout/conditional-footer"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <ConditionalFooter />
    </div>
  )
}

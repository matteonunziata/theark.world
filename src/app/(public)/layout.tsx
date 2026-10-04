import { ToastProvider } from "@/components/toast";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <ToastProvider>{children}</ToastProvider>;
}

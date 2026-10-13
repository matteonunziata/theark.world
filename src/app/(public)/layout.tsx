import { ToastProvider } from "@/components/toast";
import "./mobile.css";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <div className="pub" style={{ display: "contents" }}>
        {children}
      </div>
    </ToastProvider>
  );
}

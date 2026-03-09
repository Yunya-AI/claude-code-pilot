"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          localStorage.removeItem("auth_token");
          router.push("/login");
          return;
        }

        setLoading(false);
      } catch {
        localStorage.removeItem("auth_token");
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // 键盘弹出时，让整个布局跟随 visualViewport 上移，终端自然进入可视区
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const baseHeight = vv.height;

    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const onViewportChange = () => {
      const el = layoutRef.current;
      if (!el) return;
      if (window.innerWidth >= 1024) return;

      const keyboardHeight = baseHeight - vv.height;
      if (keyboardHeight > 50) {
        if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
        el.style.transform = `translateY(-${keyboardHeight}px)`;
        // iOS 焦点切换时 scroll-into-view 会产生额外页面滚动，持续复位
        if (vv.offsetTop > 0) window.scrollTo(0, 0);
      } else {
        // 焦点在输入元素间切换时 viewport 可能短暂恢复，延迟归零避免抖动
        if (!resetTimer) {
          resetTimer = setTimeout(() => {
            resetTimer = null;
            if (baseHeight - vv.height <= 50) el.style.transform = "";
          }, 300);
        }
      }
    };

    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div ref={layoutRef} className="flex min-h-screen overflow-x-hidden" style={{ willChange: "transform" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 w-0">
        {/* 移动端顶栏 */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b safe-area-top lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-lg">Claude Code Pilot</span>
        </header>
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}

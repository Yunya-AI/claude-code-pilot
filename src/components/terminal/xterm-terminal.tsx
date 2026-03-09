"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
}

function getTermOptions() {
  const mobile = isMobile();
  return {
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#ffffff",
      selectionBackground: "#264f78",
    },
    fontSize: mobile ? 11 : 14,
    fontFamily: mobile
      ? "ui-monospace, 'Courier New', monospace"
      : "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
    allowProposedApi: true,
    scrollback: 5000,
    cursorBlink: !mobile,
  };
}

async function createTerminal(container: HTMLElement) {
  const { Terminal } = await import("@xterm/xterm");
  const { FitAddon } = await import("@xterm/addon-fit");
  const { Unicode11Addon } = await import("@xterm/addon-unicode11");

  const mobile = isMobile();
  const term = new Terminal({ ...getTermOptions() });
  const unicode11 = new Unicode11Addon();
  term.loadAddon(unicode11);
  term.unicode.activeVersion = "11";
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);

  if (!mobile) {
    try {
      const { WebglAddon } = await import("@xterm/addon-webgl");
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {}
  }

  fitAddon.fit();
  return { term, fitAddon };
}

function isInputElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.hasAttribute("contenteditable");
}

const KEY_BTN = "flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono select-none";
const KEY_BTN_DEFAULT = `${KEY_BTN} text-gray-200 bg-[#3a3a3a] active:bg-[#555]`;
const KEY_BTN_CTRL = `${KEY_BTN} text-yellow-300 bg-[#3a3a3a] active:bg-[#555]`;

interface XTermTerminalProps {
  taskId: number;
  token: string;
  onFinished?: (status: string) => void;
}

export function XTermTerminal({ taskId, token, onFinished }: XTermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const sendRef = useRef<((data: string) => void) | null>(null);
  const pasteInputRef = useRef<HTMLInputElement>(null);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const focusTerminal = useCallback(() => {
    const ta = terminalRef.current?.querySelector("textarea");
    if (ta) ta.focus();
  }, []);

  const exitPasteMode = useCallback((sendValue?: string) => {
    if (sendValue) sendRef.current?.(sendValue);
    // 先同步聚焦终端 textarea 再卸载粘贴 input，避免焦点断档导致 iOS 键盘收起
    focusTerminal();
    setPasteMode(false);
  }, [focusTerminal]);

  useEffect(() => {
    if (!isMobile() || typeof window === "undefined") return;

    let focusOutTimer: ReturnType<typeof setTimeout> | null = null;

    const onFocusIn = (e: FocusEvent) => {
      if (isInputElement(e.target as HTMLElement)) {
        if (focusOutTimer) { clearTimeout(focusOutTimer); focusOutTimer = null; }
        setKeyboardVisible(true);
        // 终端 textarea 获焦时自动关闭粘贴输入框，避免再次点击 input 触发 iOS scroll 闪动
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA" && terminalRef.current?.contains(target)) {
          setPasteMode(false);
        }
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!isInputElement(e.target as HTMLElement)) return;
      // 焦点转移到另一个输入元素（如终端textarea→粘贴input）时不收起
      if (isInputElement(e.relatedTarget as HTMLElement)) return;
      // 延迟判断，避免 relatedTarget 为 null 的短暂间隙（iOS 常见）
      focusOutTimer = setTimeout(() => {
        focusOutTimer = null;
        if (!document.activeElement || !isInputElement(document.activeElement as HTMLElement)) {
          setKeyboardVisible(false);
        }
      }, 80);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      if (focusOutTimer) clearTimeout(focusOutTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const init = async () => {
      if (!terminalRef.current || disposed) return;
      const { term, fitAddon } = await createTerminal(terminalRef.current);
      if (disposed) { term.dispose(); return; }

      try {
        const savedToken = localStorage.getItem("auth_token");
        const res = await fetch(`/api/tasks/${taskId}/output`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        const json = await res.json();
        if (json.success && json.data?.output) {
          term.write(json.data.output);
        }
      } catch {}

      const SOCKET_URL = process.env.NODE_ENV === "production"
        ? window.location.origin
        : "http://localhost:3041";

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      sendRef.current = (data: string) => socket.emit("input", { taskId, data });

      // xterm.js 中文 IME 补偿状态，声明在 onData 之前
      let lastCompositionData = "";
      let skipNextOnData = false;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("join-task", taskId);
        setTimeout(() => {
          fitAddon.fit();
          socket.emit("resize", { taskId, cols: term.cols, rows: term.rows });
        }, 100);
      });

      socket.on("disconnect", () => setConnected(false));
      socket.on("output", ({ data }: { data: string }) => term.write(data));
      socket.on("finished", ({ status }: { status: string }) => onFinished?.(status));

      term.onData((data) => {
        if (skipNextOnData) {
          skipNextOnData = false;
          return;
        }
        socket.emit("input", { taskId, data });
      });

      const xtermTextarea = terminalRef.current?.querySelector("textarea");

      const onCompositionUpdate = (e: CompositionEvent) => {
        lastCompositionData = e.data || "";
      };
      const onCompositionEnd = (e: CompositionEvent) => {
        const data = e.data || "";
        // IME 提交纯数字时 xterm onData 不触发，需手动发送
        if (data && /^\d+$/.test(data)) {
          skipNextOnData = true;
          socket.emit("input", { taskId, data });
        }
        lastCompositionData = "";
      };
      const onBeforeInput = (e: InputEvent) => {
        if (
          e.inputType === "insertText" &&
          e.data &&
          e.data.length === 1 &&
          !lastCompositionData &&
          /[\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F]/.test(e.data)
        ) {
          socket.emit("input", { taskId, data: e.data });
        }
      };

      xtermTextarea?.addEventListener("compositionupdate", onCompositionUpdate as EventListener);
      xtermTextarea?.addEventListener("compositionend", onCompositionEnd as EventListener);
      xtermTextarea?.addEventListener("beforeinput", onBeforeInput as EventListener);

      const handleResize = () => {
        fitAddon.fit();
        socket.emit("resize", { taskId, cols: term.cols, rows: term.rows });
      };
      window.addEventListener("resize", handleResize);

      return () => {
        sendRef.current = null;
        xtermTextarea?.removeEventListener("compositionupdate", onCompositionUpdate as EventListener);
        xtermTextarea?.removeEventListener("compositionend", onCompositionEnd as EventListener);
        xtermTextarea?.removeEventListener("beforeinput", onBeforeInput as EventListener);
        window.removeEventListener("resize", handleResize);
        socket.disconnect();
        term.dispose();
      };
    };

    const cleanup = init();
    return () => {
      disposed = true;
      cleanup?.then((fn) => fn?.());
    };
  }, [taskId, token, onFinished]);

  const sendKey = (data: string) => sendRef.current?.(data);

  const handleCtrlKey = (char: string) => {
    const code = char.toUpperCase().charCodeAt(0) - 64;
    if (code > 0) sendKey(String.fromCharCode(code));
    setCtrlActive(false);
  };

  return (
    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 lg:px-4 py-1.5 lg:py-2 bg-[#323232] text-xs lg:text-sm">
        <span className="text-gray-300">终端 #{taskId}</span>
        <span className={`text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "● 已连接" : "○ 未连接"}
        </span>
      </div>

      <div ref={terminalRef} className="p-0.5 lg:p-2 terminal-height" />

      {keyboardVisible && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#2a2a2a] border-t border-[#3a3a3a] overflow-x-auto scrollbar-none">
          {pasteMode ? (
            <>
              <input
                ref={pasteInputRef}
                className="flex-1 min-w-0 px-2 py-0.5 rounded text-xs font-mono text-white bg-[#3a3a3a] border border-[#555] outline-none focus:border-blue-400"
                placeholder="在此粘贴或输入内容..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    exitPasteMode((e.target as HTMLInputElement).value || undefined);
                  }
                }}
              />
              <button onPointerDown={(e) => {
                  e.preventDefault();
                  exitPasteMode(pasteInputRef.current?.value || undefined);
                }}
                className={`${KEY_BTN} text-green-300 bg-[#3a3a3a] active:bg-[#555]`}>发送</button>
              <button onPointerDown={(e) => { e.preventDefault(); exitPasteMode(); }}
                className={`${KEY_BTN} text-gray-400 bg-[#3a3a3a] active:bg-[#555]`}>✕</button>
            </>
          ) : (
            <>
              <button onPointerDown={(e) => { e.preventDefault(); sendKey("\x1b"); }}
                className={KEY_BTN_DEFAULT}>ESC</button>
              <button onPointerDown={(e) => { e.preventDefault(); setCtrlActive(v => !v); }}
                className={`${KEY_BTN} transition-colors ${ctrlActive ? "bg-blue-500 text-white" : "bg-[#3a3a3a] text-gray-200 active:bg-[#555]"}`}>Ctrl</button>
              {ctrlActive
                ? ["C", "D", "Z", "A", "E", "L", "U"].map((k) => (
                    <button key={k} onPointerDown={(e) => { e.preventDefault(); handleCtrlKey(k); }}
                      className={KEY_BTN_CTRL}>{k}</button>
                  ))
                : <>
                    {[
                      { label: "↑", seq: "\x1b[A" },
                      { label: "↓", seq: "\x1b[B" },
                      { label: "←", seq: "\x1b[D" },
                      { label: "→", seq: "\x1b[C" },
                      { label: "Tab", seq: "\t" },
                    ].map(({ label, seq }) => (
                      <button key={label} onPointerDown={(e) => { e.preventDefault(); sendKey(seq); }}
                        className={KEY_BTN_DEFAULT}>{label}</button>
                    ))}
                    <button onPointerDown={(e) => {
                        e.preventDefault();
                        setPasteMode(true);
                        requestAnimationFrame(() => pasteInputRef.current?.focus({ preventScroll: true }));
                      }}
                      className={KEY_BTN_DEFAULT}>粘贴</button>
                  </>
              }
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface XTermReplayProps {
  taskId: number;
  output: string;
}

export function XTermReplay({ taskId, output }: XTermReplayProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;

    const init = async () => {
      if (!terminalRef.current || disposed) return;
      const { term, fitAddon } = await createTerminal(terminalRef.current);
      if (disposed) { term.dispose(); return; }

      term.options.cursorBlink = false;
      term.write(output);

      const handleResize = () => fitAddon.fit();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        term.dispose();
      };
    };

    const cleanup = init();
    return () => {
      disposed = true;
      cleanup?.then((fn) => fn?.());
    };
  }, [output]);

  return (
    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 lg:px-4 py-1.5 lg:py-2 bg-[#323232] text-xs lg:text-sm">
        <span className="text-gray-300">输出 #{taskId}</span>
      </div>
      <div ref={terminalRef} className="p-0.5 lg:p-2 terminal-height" />
    </div>
  );
}

import type { ReactNode } from "react";

type LayoutProps = {
  top: ReactNode;
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  message: string;
};

export function Layout({ top, left, main, right, message }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark">草</span>
          <div>
            <h1>草莓工作台</h1>
            <p>{message}</p>
          </div>
        </div>
        {top}
      </header>
      <div className="workspace-grid">
        <aside className="left-rail">{left}</aside>
        <main className="board-surface">{main}</main>
        <aside className="right-panel">{right}</aside>
      </div>
    </div>
  );
}

"use client";

import { useLayoutEffect, useRef } from "react";

type AppView = "latest" | "favorites" | "history";

const items: { view: AppView; label: string; icon: "activity" | "heart" | "history"; href: string }[] = [
  { view: "latest", label: "活動", icon: "activity", href: "#latest" },
  { view: "favorites", label: "最愛", icon: "heart", href: "#favorites" },
  { view: "history", label: "歷史", icon: "history", href: "#history" },
];

function NavigationIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "heart") return <svg {...common}><path d="M20.8 8.9c0 5.2-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z" /></svg>;
  if (name === "history") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.3 2" /></svg>;
  return <svg {...common}><path d="M4.5 19V5M4.5 19h15" /><path d="m7.5 15 3.2-4 3 2 4.5-6" /><path d="M15.7 7h2.5v2.5" /></svg>;
}

export function MobileBottomNavigation({ activeView, favoriteCount }: { activeView: AppView; favoriteCount: number }) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const positionRef = useRef({ x: 0, velocity: 0, initialized: false });
  const frameRef = useRef(0);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    const selectedIndex = items.findIndex((item) => item.view === activeView);
    const selectedItem = itemRefs.current[selectedIndex];
    if (!nav || !indicator || !selectedItem || selectedItem.getBoundingClientRect().width === 0) return;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const navRect = nav.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();
      const targetX = (itemRect.left - navRect.left) / itemRect.width;
      const position = positionRef.current;
      indicator.style.width = `${itemRect.width}px`;
      indicator.style.opacity = "1";

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const render = (x: number, velocity: number) => {
        const stretch = Math.min(Math.abs(velocity) / 45, 0.13);
        indicator.style.transform = `translate3d(${x * 100}%, 0, 0) scale3d(${1 + stretch}, ${1 - stretch * 0.68}, 1)`;
      };

      if (!position.initialized || reducedMotion) {
        position.x = targetX;
        position.velocity = 0;
        position.initialized = true;
        render(targetX, 0);
        return;
      }

      let previousTime = performance.now();
      const animate = (now: number) => {
        const delta = Math.min((now - previousTime) / 1000, 0.032);
        previousTime = now;
        const acceleration = (targetX - position.x) * 300 - position.velocity * 27;
        position.velocity += acceleration * delta;
        position.x += position.velocity * delta;

        if (Math.abs(targetX - position.x) < 0.12 && Math.abs(position.velocity) < 0.12) {
          position.x = targetX;
          position.velocity = 0;
          render(targetX, 0);
          frameRef.current = 0;
          return;
        }

        render(position.x, position.velocity);
        frameRef.current = requestAnimationFrame(animate);
      };
      frameRef.current = requestAnimationFrame(animate);
    });

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [activeView]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const reposition = () => {
      const indicator = indicatorRef.current;
      const selectedIndex = items.findIndex((item) => item.view === activeView);
      const selectedItem = itemRefs.current[selectedIndex];
      if (!indicator || !selectedItem || !positionRef.current.initialized) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();
      if (itemRect.width === 0) return;
      const x = (itemRect.left - navRect.left) / itemRect.width;
      positionRef.current.x = x;
      positionRef.current.velocity = 0;
      indicator.style.width = `${itemRect.width}px`;
      indicator.style.transform = `translate3d(${x * 100}%, 0, 0)`;
    };

    const observer = new ResizeObserver(reposition);
    observer.observe(nav);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  }, [activeView]);

  return (
    <nav ref={navRef} className="mobile-tabbar liquid-tab-bar" aria-label="手機版快速導覽">
      <span ref={indicatorRef} className="mobile-tabbar-indicator liquid-tab-highlight" aria-hidden="true" />
      {items.map((item, index) => {
        const selected = activeView === item.view;
        const label = item.view === "favorites" && favoriteCount ? `最愛 ${favoriteCount}` : item.label;
        return (
          <a
            key={item.view}
            ref={(element) => { itemRefs.current[index] = element; }}
            className={selected ? "active" : ""}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            aria-label={label}
          >
            <NavigationIcon name={item.icon} />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

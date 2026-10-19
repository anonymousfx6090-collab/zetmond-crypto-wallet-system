"use client";

import { useEffect, useRef, useState } from "react";

/** Progressively enhances offscreen content with a one-time entrance animation. */
export function Reveal({ children, className = "", delay = 0, as: Component = "div" }) {
  const elementRef = useRef(null);
  // Server-rendered content stays visible even when JavaScript is unavailable.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = elementRef.current;
    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    if (!element || !window.IntersectionObserver || motionPreference?.matches) return;

    const bounds = element.getBoundingClientRect();
    // Avoid hiding content that the visitor can already see during hydration.
    if (bounds.top < window.innerHeight && bounds.bottom > 0) return;

    setVisible(false);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -24px 0px" },
    );

    const handleMotionPreference = (event) => {
      if (event.matches) {
        setVisible(true);
        observer.disconnect();
      }
    };

    observer.observe(element);
    motionPreference?.addEventListener?.("change", handleMotionPreference);

    return () => {
      observer.disconnect();
      motionPreference?.removeEventListener?.("change", handleMotionPreference);
    };
  }, []);

  return (
    <Component
      ref={elementRef}
      className={`reveal ${className}`.trim()}
      data-visible={String(visible)}
      style={{ "--reveal-delay": `${Math.max(0, Number(delay) || 0)}ms` }}
      onFocusCapture={() => setVisible(true)}
    >
      {children}
    </Component>
  );
}

export default Reveal;

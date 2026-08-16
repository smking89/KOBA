"use client";

import { useEffect } from "react";

/** Locks page scroll while mounted — used by the full-screen feed view so
 * its fixed overlay can never be clipped by the underlying page scrolling. */
export function LockBodyScroll() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return null;
}

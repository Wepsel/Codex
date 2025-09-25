"use client";

import { useEffect } from "react";

export function ClusterSync() {
  useEffect(() => {
    const id = localStorage.getItem("clusterId");
    if (id) {
      document.cookie = `clusterId=${id}; path=/`;
      (globalThis as any).selectedClusterId = id;
    }
    const onStorage = () => {
      const next = localStorage.getItem("clusterId");
      if (next) {
        document.cookie = `clusterId=${next}; path=/`;
        (globalThis as any).selectedClusterId = next;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}



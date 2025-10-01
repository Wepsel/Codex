"use client";

import { useEffect } from "react";
import { setRuntimeClusterId } from "@/lib/runtime-cluster";

export function ClusterSync() {
  useEffect(() => {
    const id = localStorage.getItem("clusterId");
    if (id) {
      document.cookie = `clusterId=${id}; path=/`;
      setRuntimeClusterId(id);
    }

    const onStorage = () => {
      const next = localStorage.getItem("clusterId");
      document.cookie = `clusterId=${next ?? ""}; path=/`;
      setRuntimeClusterId(next ?? undefined);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

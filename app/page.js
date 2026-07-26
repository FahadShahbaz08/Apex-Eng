"use client";

import { ERPProvider } from "../components/ERPContext";
import AppShell from "../components/AppShell";

export default function Page() {
  return <ERPProvider><AppShell /></ERPProvider>;
}

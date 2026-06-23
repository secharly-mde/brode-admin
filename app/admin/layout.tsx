"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { importarVentasCSV } from "@/app/admin/sincronizacion/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊", group: "Finanzas" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "🛒", group: "Finanzas" },
  { href: "/admin/gastos", label: "Gastos", icon: "🧾", group: "Finanzas" },
  { href: "/admin/inventario", label: "Inventario", icon: "📦", group: "Producción" },
  { href: "/admin/produccion", label: "Producción", icon: "🍲", group: "Producción" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥", group: "Clientes" },
  { href: "/admin/sincronizacion", label: "Sincronización", icon: "🔄", group: "Ajustes" },
];

const GROUPS = ["Finanzas", "Producción", "Clientes", "Ajustes"];

type Toast = { msg: string; ok: boolean } | null;

function QuickSyncButtons({ onClose }: { onClose?: () => void }) {
  const [syncingVentas, setSyncingVentas] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleVentas = async () => {
    const url = localStorage.getItem("brode_csv_ventas");
    if (!url) { showToast("Primero configurá la URL en Sincronización", false); return; }
    setSyncingVentas(true);
    try {
      const res = await importarVentasCSV(url);
      showToast(`✅ Ventas: ${res.nuevos} pedidos importados`, true);
      if (onClose) onClose();
    } catch (err: unknown) {
      showToast(`❌ ${(err as Error).message || "Error al sincronizar"}`, false);
    } finally {
      setSyncingVentas(false);
    }
  };



  return (
    <div className="px-3 pb-1">
      {toast && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-2 leading-snug ${toast.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {toast.msg}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleVentas}
          disabled={syncingVentas}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors disabled:opacity-50 border border-emerald-200"
          title="Sincronizar Ventas desde Google Sheets"
        >
          {syncingVentas ? (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : "🛒"} Ventas
        </button>
      </div>
    </div>
  );
}

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900">Brode <span className="text-emerald-600">Admin</span></h1>
            <p className="text-xs text-gray-400">Gestión interna</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-2" aria-label="Cerrar menú">✕</button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-4 mb-1 first:mt-0">{group}</p>
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
              const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Accesos rápidos de sync — debajo del nav item de Ajustes */}
            {group === "Ajustes" && mounted && (
              <div className="mt-1.5">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider px-3 mb-1">Sync rápido</p>
                <QuickSyncButtons onClose={onClose} />
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50">
          <span className="text-lg">🌿</span>
          <div>
            <p className="text-xs font-semibold text-emerald-800">Brode</p>
            <p className="text-xs text-emerald-600">2026</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPage = NAV_ITEMS.find((i) =>
    i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">

      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shadow-sm flex-shrink-0">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* ── Mobile Overlay ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-xl transform transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent pathname={pathname} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* ── Main area ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center text-white font-bold text-xs">B</div>
            <span className="font-semibold text-sm text-gray-800">
              {currentPage ? currentPage.label : "Brode Admin"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getPedidos, getGastos } from "@/lib/firestore";
import type { Pedido, Gasto } from "@/lib/types";

function getMesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const fecha = new Date(Number(y), Number(m) - 1, 1);
  return fecha.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
}

const catIcons: Record<string, string> = {
  Cocina: "🍲", Local: "🏠", Reparto: "🚚", Personal: "👥", Admin: "💻",
};

export default function Dashboard() {
  const [mes, setMes] = useState(getMesActual());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [p, g] = await Promise.all([getPedidos(mes), getGastos(mes)]);
        setPedidos(p);
        setGastos(g);
      } catch (err: any) {
        console.error("Error loading data:", err);
        setError(err.message || "Error desconocido al cargar los datos de Firebase.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mes]);

  const totalIngresos = pedidos.reduce((a, p) => a + p.total, 0);
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0);
  const ganancia = totalIngresos - totalGastos;
  const margen = totalIngresos > 0 ? Math.round((ganancia / totalIngresos) * 100) : 0;
  const totalFrascos = pedidos.reduce((a, p) => a + p.frascos, 0);

  const gastosPorCategoria = gastos.reduce((acc: Record<string, number>, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto;
    return acc;
  }, {});

  const maxGasto = Math.max(...Object.values(gastosPorCategoria), 1);

  // Mes selector: últimos 12 meses
  const meses: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const ultimos5Pedidos = pedidos.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 capitalize">Resumen financiero · {getMesLabel(mes)}</p>
        </div>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {meses.map((m) => (
            <option key={m} value={m}>{getMesLabel(m)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">🌿</div>
            <p>Cargando datos...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-500">
          <div className="text-center max-w-md bg-red-50 p-6 rounded-2xl border border-red-100">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-semibold mb-2">Hubo un error cargando los datos</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-sm text-gray-500">Ingresos</p>
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-lg">💰</div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {totalIngresos > 0 ? `$${totalIngresos.toLocaleString()}` : "—"}
              </p>
              <p className="text-xs font-medium mt-1 text-gray-400">{totalFrascos} frascos vendidos</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-sm text-gray-500">Gastos</p>
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-lg">📉</div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {totalGastos > 0 ? `$${totalGastos.toLocaleString()}` : "—"}
              </p>
              <p className="text-xs font-medium mt-1 text-gray-400">{gastos.length} registros</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-sm text-gray-500">Ganancia Neta</p>
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-lg">✅</div>
              </div>
              <p className={`text-2xl font-bold mt-2 ${ganancia >= 0 ? "text-gray-900" : "text-red-600"}`}>
                {totalIngresos > 0 ? `$${ganancia.toLocaleString()}` : "—"}
              </p>
              <p className={`text-xs font-medium mt-1 ${margen > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                {totalIngresos > 0 ? `Margen ${margen}%` : "Sin datos este mes"}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-sm text-gray-500">Pedidos</p>
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-lg">🛒</div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pedidos.length}</p>
              <p className="text-xs font-medium mt-1 text-amber-600">
                {pedidos.filter(p => p.estado === "Pendiente").length} pendiente(s) de cobro
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Últimos pedidos */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-gray-900">Últimos Pedidos</h2>
                <a href="/admin/pedidos" className="text-xs text-emerald-600 font-medium hover:underline">Ver todos →</a>
              </div>
              {ultimos5Pedidos.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-2xl mb-2">🛒</p>
                  <p className="text-sm">Sin pedidos este mes</p>
                  <a href="/admin/pedidos" className="text-xs text-emerald-600 font-medium mt-1 inline-block hover:underline">
                    Registrar primer pedido →
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {ultimos5Pedidos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                          {p.cliente[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.cliente}</p>
                          <p className="text-xs text-gray-400">{p.tipo} · {p.frascos} frascos · {p.fecha}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">${p.total.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.estado === "Pagado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {p.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gastos por categoría */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Gastos por Categoría</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {totalGastos > 0 ? `Total: $${totalGastos.toLocaleString()}` : "Sin gastos este mes"}
                </p>
              </div>
              {Object.keys(gastosPorCategoria).length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-2xl mb-2">📋</p>
                  <p className="text-sm">Sin gastos registrados</p>
                  <a href="/admin/gastos" className="text-xs text-red-500 font-medium mt-1 inline-block hover:underline">
                    Registrar gasto →
                  </a>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {Object.entries(gastosPorCategoria)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, total]) => (
                      <div key={cat}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span>{catIcons[cat] || "📌"}</span> {cat}
                          </span>
                          <span className="text-xs font-semibold text-gray-800">${total.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.round((total / maxGasto) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Accesos rápidos si no hay datos */}
          {pedidos.length === 0 && gastos.length === 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-6 text-center">
              <p className="text-2xl mb-2">🌿</p>
              <h3 className="font-semibold text-gray-800 mb-1">¡Todo listo para empezar!</h3>
              <p className="text-sm text-gray-500 mb-4">El panel está conectado a Firebase. Registrá tu primer pedido o gasto.</p>
              <div className="flex justify-center gap-3">
                <a href="/admin/pedidos" className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                  ➕ Nuevo Pedido
                </a>
                <a href="/admin/gastos" className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
                  ➕ Registrar Gasto
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

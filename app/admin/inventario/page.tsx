"use client";

import { useState, useEffect } from "react";
import { getStock, getMovimientos, ajustarStock } from "@/lib/firestore";
import type { MovimientoInventario } from "@/lib/types";

export default function InventarioPage() {
  const [stock, setStock] = useState({ res: 0, pollo: 0 });
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showAjuste, setShowAjuste] = useState(false);
  const [ajusteRes, setAjusteRes] = useState(0);
  const [ajustePollo, setAjustePollo] = useState(0);
  const [ajusteMotivo, setAjusteMotivo] = useState("Ajuste manual");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [stk, movs] = await Promise.all([getStock(), getMovimientos()]);
    setStock(stk);
    setAjusteRes(stk.res);
    setAjustePollo(stk.pollo);
    setMovimientos(movs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ajustarStock(ajusteRes, ajustePollo, ajusteMotivo);
      await loadData();
      setShowAjuste(false);
    } catch (error) {
      console.error(error);
      alert("Error al guardar ajuste");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">Control de stock de caldos en tiempo real</p>
        </div>
        <button
          onClick={() => {
            setAjusteRes(stock.res);
            setAjustePollo(stock.pollo);
            setAjusteMotivo("Ajuste manual");
            setShowAjuste(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>⚖️</span> Ajustar Stock
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p>Cargando inventario...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tarjetas de Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-orange-100 shadow-sm flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm font-bold text-orange-900 mb-1 uppercase tracking-wider">Caldo de Huesos de Res</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-orange-600">{stock.res}</span>
                  <span className="text-orange-800 font-medium">frascos</span>
                </div>
              </div>
              <div className="text-7xl opacity-20 absolute right-4 -bottom-4 rotate-12">🐮</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-2xl border border-yellow-100 shadow-sm flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm font-bold text-yellow-900 mb-1 uppercase tracking-wider">Caldo de Huesos de Pollo</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-yellow-600">{stock.pollo}</span>
                  <span className="text-yellow-800 font-medium">frascos</span>
                </div>
              </div>
              <div className="text-7xl opacity-20 absolute right-4 -bottom-4 rotate-12">🐔</div>
            </div>
          </div>

          {/* Historial */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Historial de Movimientos</h2>
            </div>
            
            {movimientos.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">📜</p>
                <p className="text-gray-500 font-medium">No hay movimientos registrados</p>
                <p className="text-sm text-gray-400 mt-1">Cuando registres un lote o pedido, aparecerá acá.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3">Fecha</th>
                      <th className="px-5 py-3">Variedad</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Cantidad</th>
                      <th className="px-5 py-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(m.createdAt || m.fecha).toLocaleDateString("es-UY", { 
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {m.item === "Res" ? "🐮 Res" : "🐔 Pollo"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                            m.tipo === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>
                            {m.tipo === "entrada" ? "ENTRADA" : "SALIDA"}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-gray-900">
                          {m.tipo === "entrada" ? "+" : "-"}{m.cantidad}
                        </td>
                        <td className="px-5 py-3 text-gray-500">{m.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Ajuste */}
      {showAjuste && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Ajuste Manual de Stock</h3>
              <button onClick={() => setShowAjuste(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleAjuste} className="p-5 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4">
                Ingresá el <strong>stock real total</strong> que tenés hoy. El sistema calculará la diferencia automáticamente.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Stock Res</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={ajusteRes}
                    onChange={(e) => setAjusteRes(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Stock Pollo</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={ajustePollo}
                    onChange={(e) => setAjustePollo(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Motivo del Ajuste</label>
                <input
                  type="text"
                  required
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  placeholder="Ej: Stock Inicial, Merma por rotura, Recuento..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAjuste(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

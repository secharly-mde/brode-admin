"use client";

import { useState, useEffect } from "react";
import { importarVentasCSV, importarGastosCSV } from "./actions";

export default function SincronizacionPage() {
  const [urlVentas, setUrlVentas] = useState("");
  const [urlGastos, setUrlGastos] = useState("");
  
  const [isSyncingVentas, setIsSyncingVentas] = useState(false);
  const [isSyncingGastos, setIsSyncingGastos] = useState(false);
  
  const [resultVentas, setResultVentas] = useState<{ nuevos: number, borrados: number, error?: string } | null>(null);
  const [resultGastos, setResultGastos] = useState<{ nuevos: number, borrados: number, error?: string } | null>(null);

  useEffect(() => {
    // Cargar URLs guardadas
    const savedVentas = localStorage.getItem("brode_csv_ventas");
    if (savedVentas) setUrlVentas(savedVentas);
  }, []);

  const handleUrlChange = (type: "ventas", url: string) => {
    setUrlVentas(url);
    localStorage.setItem("brode_csv_ventas", url);
  };

  const handleSyncVentas = async () => {
    if (!urlVentas) return;
    setIsSyncingVentas(true);
    setResultVentas(null);
    try {
      const res = await importarVentasCSV(urlVentas);
      setResultVentas(res);
    } catch (err: unknown) {
      setResultVentas({ nuevos: 0, borrados: 0, error: (err as Error).message || "Error desconocido" });
    } finally {
      setIsSyncingVentas(false);
    }
  };



  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sincronización con Google Sheets</h1>
        <p className="text-gray-500">
          Importá automáticamente tus datos desde tus planillas de Google Sheets publicadas como CSV.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta de Ventas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl">🛒</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ventas (Pedidos)</h2>
              <p className="text-xs text-gray-500">Sincroniza la planilla semanal de pedidos</p>
            </div>
          </div>
          
          <div className="flex-1 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link CSV de Google Sheets
            </label>
            <input 
              type="url" 
              value={urlVentas}
              onChange={(e) => handleUrlChange("ventas", e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-1.../pub?output=csv"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Se guardará automáticamente para la próxima vez.
            </p>
          </div>

          {resultVentas && (
            <div className={`p-4 mb-6 rounded-lg text-sm ${resultVentas.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {resultVentas.error ? (
                <p><strong>Error:</strong> {resultVentas.error}</p>
              ) : (
                <>
                  <p className="font-bold mb-1">✅ Importación completada</p>
                  <ul className="list-disc pl-5">
                    <li>Pedidos viejos eliminados: <strong>{resultVentas.borrados}</strong></li>
                    <li>Nuevos pedidos importados: <strong>{resultVentas.nuevos}</strong></li>
                  </ul>
                </>
              )}
            </div>
          )}

          <button 
            onClick={handleSyncVentas}
            disabled={!urlVentas || isSyncingVentas}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {isSyncingVentas ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sincronizando...
              </>
            ) : "Sincronizar Ventas"}
          </button>
        </div>


      </div>
    </div>
  );
}

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load env vars first
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  // Now dynamically import the firestore module so that env vars are populated
  const { getClientes, addCliente } = await import('../lib/firestore');
  
  const filePath = '/Users/Charly/.gemini/antigravity/brain/baa21c29-c86f-4939-85a9-b3995945900f/clientes_limpios.md';
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const lines = content.split('\n');
  const clients = [];
  
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---|')) continue;
    if (line.includes('Nombre | Dirección')) continue;
    
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 5) continue;
    
    const nombre = parts[1];
    const direccion = parts[2];
    const telefono = parts[3];
    const mapa = parts[4];
    
    if (nombre) {
      clients.push({ nombre, direccion, telefono, mapa });
    }
  }
  
  console.log(`Leídos ${clients.length} clientes del markdown.`);
  
  const existing = await getClientes();
  const existingNames = new Set(existing.map((c: any) => c.nombre.toLowerCase()));
  
  let added = 0;
  for (const c of clients) {
    if (!existingNames.has(c.nombre.toLowerCase())) {
      let notas = "";
      if (c.mapa && c.mapa.includes("http")) {
        const match = c.mapa.match(/\]\((.*?)\)/);
        const url = match ? match[1] : c.mapa;
        notas = `Mapa: ${url}`;
      }
      
      await addCliente({
        nombre: c.nombre,
        tipo: "Retail",
        canal: "Retail",
        precio: 280,
        activo: true,
        tel: c.telefono || "",
        direccion: c.direccion || "",
        notas: notas
      });
      added++;
      console.log(`Añadido: ${c.nombre}`);
    } else {
      console.log(`Omitido (ya existe): ${c.nombre}`);
    }
  }
  
  console.log(`Proceso finalizado. ${added} nuevos clientes añadidos.`);
  process.exit(0);
}

main().catch(console.error);

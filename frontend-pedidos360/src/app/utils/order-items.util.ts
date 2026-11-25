import { Order, OrderItemDetail } from '../models/order.model';
import { Product } from '../models/product.model';

function name(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return !text || /^(pedido corporativo|producto corporativo|producto general|sin producto|detalle no especificado|sin detalle registrado|productos en orden)/i.test(text) ? undefined : text;
}
function positive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
function price(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
export function resolveOrderItems(order: Order, products: Product[]): OrderItemDetail[] {
  const catalog = (id: unknown) => products.find(p => p.id === positive(id));
  const total = price(order.total ?? order.monto);
  const parse = (rows: unknown[]): OrderItemDetail[] => rows.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, any>;
    const id = positive(item['productId'] ?? item['productoId'] ?? item['product']?.id);
    const qty = positive(item['quantity'] ?? item['cantidad'] ?? item['cant']);
    const recordedName = name(item['nombre'] ?? item['productoNombre'] ?? item['productName'] ?? item['nombreProducto'] ?? item['product']?.nombre);
    const label = recordedName ?? catalog(id)?.nombre ?? (id ? `Producto #${id}` : undefined);
    if (!label || !qty) return [];
    const unit = price(item['price'] ?? item['precioUnitario'] ?? item['precio'] ?? item['product']?.precio);
    return [{ productoId: id, nombre: label, cantidad: qty, precioUnitario: unit,
      subtotal: unit === undefined ? undefined : unit * qty, nombreDesdeCatalogo: !recordedName && !!catalog(id) }];
  });
  const detail = typeof order.detalleProductos === 'string' ? order.detalleProductos.trim() : '';
  if (detail.startsWith('[')) {
    try {
      const rows: unknown = JSON.parse(detail);
      if (Array.isArray(rows) && rows.length) {
        const result = parse(rows);
        if (result.length === rows.length) return result;
      }
    } catch { /* dato inválido: continuar con campos individuales */ }
  } else if (name(detail)) {
    // Formato anterior: nombre (x2), otro nombre (x1).
    const rows = [...detail.matchAll(/(?:^|,\s*)(.+?)\s*\(x\s*(\d+)\)/gi)];
    if (rows.length && rows.map(m => m[0]).join('').trim() === detail) {
      return rows.map(m => ({ nombre: m[1].trim(), cantidad: positive(m[2]) ?? 0 }));
    }
    if (positive(order.cantidad)) return [{ nombre: detail, cantidad: positive(order.cantidad)! }];
  }
  for (const rows of [order.items, order.productos, order.orderItems]) {
    if (Array.isArray(rows) && rows.length) {
      const result = parse(rows);
      if (result.length === rows.length) return result;
    }
  }
  const recordedName = name(order.productoNombre);
  const product = catalog(order.productoId);
  const label = recordedName ?? product?.nombre ?? (order.productoId ? `Producto #${order.productoId}` : undefined);
  if (label) {
    const qty = positive(order.cantidad) ?? 0;
    return [{ productoId: order.productoId, nombre: label, cantidad: qty, nombreDesdeCatalogo: !recordedName && !!product }];
  }
  // Solo coincidencias exactas de UN producto. Nunca se persisten como hechos.
  if (order.id != null && order.id <= 55 && total !== undefined && total > 0) {
    const matches = products.filter(p => p.precio > 0 && Number.isSafeInteger(total / p.precio));
    if (matches.length === 1) {
      const p = matches[0];
      return [{ productoId: p.id, nombre: p.nombre, cantidad: total / p.precio, precioUnitario: p.precio, subtotal: total, estimado: true }];
    }
  }
  return [];
}
export function orderSummary(order: Order, products: Product[]): string {
  const items = resolveOrderItems(order, products);
  return items.length ? items.map(i => `${i.nombre}${i.cantidad ? ` (x${i.cantidad})` : ' (cantidad no registrada)'}${i.estimado ? ' [Estimado por monto]' : i.nombreDesdeCatalogo ? ' [Nombre actual del catálogo]' : ''}`).join(', ') : 'Detalle histórico no disponible';
}
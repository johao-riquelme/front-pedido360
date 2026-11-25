export type OrderStatus =
  | 'CREADO'
  | 'PAGADO'
  | 'ACEPTADO'
  | 'EN_PREPARACIÓN'
  | 'DESPACHADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | string;

export interface OrderItemDetail {
  productoId?: number;
  nombre: string;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
  estimado?: boolean;
  nombreDesdeCatalogo?: boolean;
}

export interface Order {
  id?: number;
  cliente: string;
  monto: number;
  total?: number;
  estado: OrderStatus;
  fecha?: string;
  productoId?: number;
  productoNombre?: string;
  cantidad?: number;
  metodoPago?: string;
  detalleProductos?: string;
  items?: any[];
  productos?: any[];
  orderItems?: any[];
}

export interface ExtendedOrder extends Order {
  monto: number;
  total?: number;
  productoId?: number;
  productoNombre?: string;
  cantidad?: number;
  metodoPago?: string;
  detalleProductos?: string;
  parsedItems?: OrderItemDetail[];
}
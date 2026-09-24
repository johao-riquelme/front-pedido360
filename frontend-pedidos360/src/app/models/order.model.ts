export type OrderStatus = 'CREADO' | 'EN_PREPARACIÓN' | 'ENTREGADO' | 'CANCELADO' | string;

export interface Order {
  id?: number;
  cliente: string;
  monto: number;
  total?: number;
  estado: OrderStatus | string;
  fecha?: string;
  productoNombre?: string;
  cantidad?: number;
}

export interface ExtendedOrder extends Order {
  monto: number;
  total?: number;
  productoNombre?: string;
  cantidad?: number;
}
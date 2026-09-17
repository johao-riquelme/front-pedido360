export type OrderStatus = 'CREADO' | 'ACEPTADO' | 'EN_PREPARACIÓN' | 'DESPACHADO' | 'ENTREGADO' | 'CANCELADO';

export interface Order {
  id?: number;
  cliente: string;
  monto: number;
  estado: OrderStatus;
  fecha?: string;
}
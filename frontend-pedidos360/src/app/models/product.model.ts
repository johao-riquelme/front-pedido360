export interface Product {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  descripcion?: string;
  imagenUrl?: string;
}
export interface Product {
  id?: number;
  nombre: string;
  precio: number;
  stock: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface WebpayInitResponse {
  url: string;
  token: string;
}
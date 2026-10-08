import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { Product } from '../app';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  
  // Rutas relativas que pasan por el proxy de Nginx hacia Spring Boot
  private apiUrl = '/api/orders';
  private productsUrl = '/api/products'; // Si tu backend usa español, cámbialo a '/api/productos'

  // --- PEDIDOS ---
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl).pipe(
      map(orders => orders.map(o => ({
        ...o,
        monto: o.monto ?? o.total ?? 0
      })))
    );
  }

  createOrder(order: Order): Observable<Order> {
    const payload = {
      ...order,
      total: order.monto ?? order.total ?? 0
    };
    return this.http.post<Order>(this.apiUrl, payload);
  }

  updateStatus(id: number, estado: OrderStatus): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/status`, { estado });
  }

  deleteOrder(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // --- PRODUCTOS (NEON DB) ---
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl);
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(this.productsUrl, product);
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.productsUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.productsUrl}/${id}`);
  }
}
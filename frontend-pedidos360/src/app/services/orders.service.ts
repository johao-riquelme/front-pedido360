import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { Product } from '../app';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  
  // Rutas relativas que pasan por el proxy de Nginx en la EC2
  private apiUrl = '/api/orders';
  private productsUrl = '/api/products';

  // --- PEDIDOS ---
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl).pipe(
      map(orders => orders.map(o => ({
        ...o,
        monto: o.monto ?? o.total ?? 0
      }))),
      catchError((err) => {
        console.warn('Backend de Pedidos no disponible. Cargando datos locales de respaldo:', err);
        return of([
          { id: 101, cliente: 'Empresa Alpha', productoNombre: 'Notebook Gamer Pro', cantidad: 2, monto: 1700000, estado: 'CREADO' },
          { id: 102, cliente: 'Juan Pérez', productoNombre: 'Monitor 27" 144Hz 4K', cantidad: 1, monto: 290000, estado: 'ACEPTADO' }
        ]);
      })
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
    return this.http.get<Product[]>(this.productsUrl).pipe(
      catchError((err) => {
        console.warn('Backend de Productos no disponible. Cargando datos locales de respaldo:', err);
        return of([
          { id: 1, nombre: 'Notebook Gamer Pro', precio: 850000, stock: 12, categoria: 'Equipos' },
          { id: 2, nombre: 'Monitor 27" 144Hz 4K', precio: 290000, stock: 8, categoria: 'Monitores' },
          { id: 3, nombre: 'Teclado Mecánico RGB', precio: 65000, stock: 25, categoria: 'Periféricos' },
          { id: 4, nombre: 'Mouse Inalámbrico Ergo', precio: 42000, stock: 18, categoria: 'Periféricos' }
        ]);
      })
    );
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
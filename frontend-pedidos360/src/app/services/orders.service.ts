import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { Order, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/orders';

  private mockOrders: Order[] = [
    { id: 101, cliente: 'Empresa Alfa', monto: 250000, estado: 'ENTREGADO', fecha: '2026-03-08' },
    { id: 102, cliente: 'Comercial Beta', monto: 120000, estado: 'EN_PREPARACIÓN', fecha: '2026-03-09' },
    { id: 103, cliente: 'Distribuidora Gamma', monto: 450000, estado: 'CREADO', fecha: '2026-03-10' }
  ];

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl).pipe(
      catchError(() => of(this.mockOrders))
    );
  }

  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, order);
  }

  updateStatus(id: number, estado: OrderStatus): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/status`, { estado });
  }

  deleteOrder(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
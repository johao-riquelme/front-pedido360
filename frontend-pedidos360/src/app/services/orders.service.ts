import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = 'http://50.19.148.76:8080/api/orders';

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
}
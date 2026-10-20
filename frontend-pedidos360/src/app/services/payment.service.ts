import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WebpayInitResponse } from '../models/cart.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = '/api/payments';

  // Solicita la sesión de pago al backend Java
  initiateWebpay(payload: any): Observable<WebpayInitResponse> {
    return this.http.post<WebpayInitResponse>(`${this.apiUrl}/initiate`, payload);
  }

  // Redirige automáticamente al formulario seguro de Transbank Webpay
  redirectToWebpay(url: string, token: string): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;

    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token_ws';
    tokenInput.value = token;

    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();
  }
}
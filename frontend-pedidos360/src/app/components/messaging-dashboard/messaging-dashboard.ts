import { Component, DestroyRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { defer, from, of, timer } from 'rxjs';
import { catchError, exhaustMap, map, switchMap, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { protectedResources } from '../../auth-config';

interface AuditEvent { topico: string; particion: number; kafka_offset: number; pedido_id: string; estado: string; monto: number; procesado_en: string; }
interface AuditSnapshot { resumen: { eventos_total: number; eventos_pedidos: number; eventos_pagos: number; pagos_autorizados: number; monto_autorizado: number }; eventos: AuditEvent[]; consultadoEn: string; }
interface Partition { topico: string; grupo: string; estadoGrupo: string; particion: number; replicas: number; offsetActual: number | null; offsetFinal: number; lag: number | null; }
interface Queue { nombre: string; disponible: boolean; pendientes?: number; consumidores?: number; }
interface BrokersSnapshot { kafka: { disponible: boolean; brokers?: number; topicos?: number; grupos?: number; lagTotal?: number | null; particiones?: Partition[]; error?: string }; rabbit: { colas: Queue[] }; consultadoEn: string; }

@Component({ selector: 'app-messaging-dashboard', standalone: true, imports: [CommonModule], templateUrl: './messaging-dashboard.html', styleUrl: './messaging-dashboard.css' })
export class MessagingDashboardComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly destroyRef = inject(DestroyRef);
  private readonly platform = inject(PLATFORM_ID);
  readonly audit = signal<AuditSnapshot | null>(null);
  readonly brokers = signal<BrokersSnapshot | null>(null);
  readonly auditError = signal('');
  readonly brokerError = signal('');
  readonly authorizing = signal(false);
  private request<T>(path: string) {
    return defer(() => {
      const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
      if (!account) throw new Error('Inicia sesión');
      return from(this.msal.instance.acquireTokenSilent({ account, scopes: protectedResources.ordersApi.scopes }));
    }).pipe(switchMap(token => this.http.get<T>('/api/monitoreo/' + path, { headers: { Authorization: 'Bearer ' + token.accessToken } })), timeout(30000));
  }
  private message(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) return 'JWT no aceptado. Verifica emisor, audiencia y consentimiento.';
      if (err.status === 403) return 'Usuario sin autorización de administrador para monitoreo.';
      return 'No se pudo consultar el servidor (HTTP ' + err.status + ').';
    }
    return 'No se pudo obtener el token o la consulta expiró.';
  }
  ngOnInit(): void {
    if (!isPlatformBrowser(this.platform)) return;
    timer(0, 5000).pipe(exhaustMap(() => this.request<AuditSnapshot>('auditoria').pipe(
      map(data => ({ data, error: '' })), catchError(err => of({ data: null, error: this.message(err) })))),
      takeUntilDestroyed(this.destroyRef)).subscribe(r => { this.audit.set(r.data); this.auditError.set(r.error); });
    timer(0, 30000).pipe(exhaustMap(() => this.request<BrokersSnapshot>('brokers').pipe(
      map(data => ({ data, error: '' })), catchError(err => of({ data: null, error: this.message(err) })))),
      takeUntilDestroyed(this.destroyRef)).subscribe(r => { this.brokers.set(r.data); this.brokerError.set(r.error); });
  }
  async autorizar(): Promise<void> {
    this.authorizing.set(true);
    try {
      const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
      await this.msal.instance.acquireTokenPopup({ account, scopes: protectedResources.ordersApi.scopes });
    } catch (err) { this.auditError.set(this.message(err)); }
    finally { this.authorizing.set(false); }
  }
}

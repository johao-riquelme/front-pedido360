import { Component, OnInit, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus, AuthenticationResult } from '@azure/msal-browser';
import { filter } from 'rxjs/operators';
import { loginRequest } from './auth-config';
import { OrdersService } from './services/orders.service';
import { ExtendedOrder, OrderItemDetail, OrderStatus } from './models/order.model';
import { Product } from './models/product.model';
import { resolveOrderItems, orderSummary } from './utils/order-items.util';
import { CustomerViewComponent } from './components/customer-view/customer-view';
import { MessagingDashboardComponent } from './components/messaging-dashboard/messaging-dashboard';

export interface AuditLog {
  id: string;
  evento: string;
  usuario: string;
  timestamp: string;
  detalle: string;
  origen: 'DB' | 'SESION';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomerViewComponent,
    MessagingDashboardComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private msalService = inject(MsalService);
  private msalBroadcastService = inject(MsalBroadcastService);
  private ordersService = inject(OrdersService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  isLoggedIn = false;
  userName = '';
  userEmail = '';
  userRole: 'Admin' | 'Client' = 'Client';
  activeTab = 'store';

  products: Product[] = [];
  orders: ExtendedOrder[] = [];
  sessionAuditLogs: AuditLog[] = [];

  // Filtros en Gestión de Pedidos
  companySearchFilter = '';
  selectedCompanyFilter = '';
  selectedStatusFilter = '';

  // Modal de Detalle de Compra por Empresa
  detailOrder: ExtendedOrder | null = null;
  detailItems: OrderItemDetail[] = [];

  // Formulario Crear Pedido
  newCliente = '';
  selectedProductId: number | null = null;
  selectedCantidad = 1;
  newMonto: number | null = null;
  showCreateForm = false;
  errorMessage = '';

  // Formulario Crear Producto (con imagenUrl y descripcion)
  newProdNombre = '';
  newProdCategoria = '';
  newProdPrecio: number | null = null;
  newProdStock: number | null = null;
  newProdImagenUrl = '';
  newProdDescripcion = '';
  showProdForm = false;
  prodErrorMessage = '';
  isSavingProduct = false;

  // Edición Producto (Catálogo)
  editingProductId: number | null = null;
  editProdNombre = '';
  editProdCategoria = '';
  editProdPrecio: number | null = null;
  editProdStock: number | null = null;
  editProdImagenUrl = '';
  editProdDescripcion = '';

  // Edición Pedido (Pedidos)
  editingOrderId: number | null = null;
  editCliente = '';
  editProductId: number | null = null;
  editCantidad = 1;
  editMonto = 0;
  editErrorMessage = '';

  // Modal de Confirmación / Alerta
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'confirm' | 'alert' = 'confirm';
  onModalConfirm: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      await this.msalService.instance.initialize();
    } catch (e) {
      console.warn('MSAL initialization warning:', e);
    }

    this.syncDatabase();

    this.msalService.handleRedirectObservable().subscribe({
      next: (result: AuthenticationResult | null) => {
        if (result && result.account) {
          this.msalService.instance.setActiveAccount(result.account);
        }
        this.checkAccount();
      }
    });

    this.msalBroadcastService.inProgress$
      .pipe(filter((status: InteractionStatus) => status === InteractionStatus.None))
      .subscribe(() => {
        this.checkAccount();
      });
  }

  syncDatabase(): void {
    this.loadOrders();
    this.loadProducts();
  }

  loadOrders(): void {
    this.ordersService.getOrders().subscribe({
      next: (data) => {
        this.orders = (data || [])
          .map(o => ({
            ...o,
            cliente: o.cliente || 'Sin Empresa',
            monto: o.monto ?? o.total ?? 0
          }))
          .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener pedidos de Neon DB:', err);
      }
    });
  }

  loadProducts(): void {
    this.ordersService.getProducts().subscribe({
      next: (data) => {
        this.products = (data || []).sort((a, b) => a.id - b.id);
        if (this.detailOrder) this.detailItems = this.extractOrderItems(this.detailOrder);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener productos de Neon DB:', err);
      }
    });
  }

  checkAccount(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const activeAccount =
      this.msalService.instance.getActiveAccount() ||
      this.msalService.instance.getAllAccounts()[0];

    if (activeAccount) {
      this.msalService.instance.setActiveAccount(activeAccount);
      this.isLoggedIn = true;
      this.userName = activeAccount.name || activeAccount.username;

      const claims = activeAccount.idTokenClaims as any;
      const rawEmail = (
        claims?.preferred_username ||
        claims?.email ||
        activeAccount.username ||
        ''
      ).toLowerCase().trim();
      this.userEmail = rawEmail;

      if (rawEmail.includes('joh.riquelme@duocuc.cl') || rawEmail.includes('johao.riquelme')) {
        this.userRole = 'Admin';
        if (this.activeTab === 'store') this.activeTab = 'orders';
      } else if (rawEmail.includes('mat.castanedaq@duocuc.cl')) {
        this.userRole = 'Admin';
        if (this.activeTab === 'store') this.activeTab = 'catalog';
      } else if (rawEmail.includes('emi.parra@duocuc.cl')) {
        this.userRole = 'Admin';
        if (this.activeTab === 'store') this.activeTab = 'reports';
      } else if (rawEmail.includes('ale.cortez@duocuc.cl')) {
        this.userRole = 'Client';
        this.activeTab = 'store';
      } else {
        this.userRole = 'Client';
        this.activeTab = 'store';
      }
    } else {
      this.isLoggedIn = false;
      this.userRole = 'Client';
      this.activeTab = 'store';
    }

    this.cdr.detectChanges();
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'reports' || tab === 'orders') {
      this.loadOrders();
    }
    if (tab === 'catalog' || tab === 'reports') {
      this.loadProducts();
    }
  }

  openOrderDetail(order: ExtendedOrder): void {
    this.detailOrder = order;
    this.detailItems = this.extractOrderItems(order);
  }

  closeOrderDetail(): void {
    this.detailOrder = null;
    this.detailItems = [];
  }

  getTotalDetailUnits(): number {
    return this.detailItems.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
  }

  extractOrderItems(order: ExtendedOrder): OrderItemDetail[] {
    return resolveOrderItems(order, this.products);
  }

  getOrderSummaryLabel(order: ExtendedOrder): string {
    return orderSummary(order, this.products);
  }

  get uniqueCompanies(): string[] {
    const names = this.orders
      .map(o => (o.cliente || '').trim())
      .filter(name => name.length > 0);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'es'));
  }

  get filteredOrders(): ExtendedOrder[] {
    const search = this.companySearchFilter.toLowerCase().trim();
    const selectedCompany = this.selectedCompanyFilter.trim();
    const selectedStatus = this.selectedStatusFilter.toUpperCase().trim();

    return this.orders.filter(order => {
      const cliente = (order.cliente || '').trim();
      const matchesSearch = !search || cliente.toLowerCase().includes(search);
      const matchesDropdown = !selectedCompany || cliente === selectedCompany;
      const matchesStatus = !selectedStatus || (order.estado || '').toUpperCase() === selectedStatus;
      return matchesSearch && matchesDropdown && matchesStatus;
    });
  }

  clearOrderFilters(): void {
    this.companySearchFilter = '';
    this.selectedCompanyFilter = '';
    this.selectedStatusFilter = '';
  }

  getProductImage(product: Partial<Product> | null | undefined): string {
    if (product?.imagenUrl && product.imagenUrl.trim().startsWith('http')) {
      return product.imagenUrl.trim();
    }

    const name = (product?.nombre || '').toLowerCase();
    if (name.includes('mouse') || name.includes('ratón') || name.includes('raton')) {
      return 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&auto=format&fit=crop&q=80';
    }
    if (name.includes('teclado') || name.includes('keyboard')) {
      return 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&auto=format&fit=crop&q=80';
    }
    if (name.includes('laptop') || name.includes('notebook') || name.includes('macbook') || name.includes('computador')) {
      return 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&auto=format&fit=crop&q=80';
    }
    if (name.includes('monitor') || name.includes('pantalla')) {
      return 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&auto=format&fit=crop&q=80';
    }
    if (name.includes('audifono') || name.includes('headphone') || name.includes('auricular')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=400&auto=format&fit=crop&q=80';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=400&auto=format&fit=crop&q=80';
  }

  private logSessionEvent(evento: string, detalle: string): void {
    this.sessionAuditLogs.unshift({
      id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      evento,
      usuario: this.userEmail || this.userName || 'Admin',
      timestamp: new Date().toLocaleString('es-CL'),
      detalle,
      origen: 'SESION'
    });
  }

  openConfirmModal(title: string, message: string, action: () => void): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = 'confirm';
    this.onModalConfirm = action;
    this.showModal = true;
  }

  openAlertModal(title: string, message: string): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = 'alert';
    this.onModalConfirm = null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.onModalConfirm = null;
  }

  executeModalAction(): void {
    if (this.onModalConfirm) {
      this.onModalConfirm();
    }
    this.closeModal();
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.errorMessage = '';
  }

  onProductSelect(): void {
    const prod = this.products.find(p => Number(p.id) === Number(this.selectedProductId));
    if (prod) {
      this.newMonto = prod.precio * (this.selectedCantidad || 1);
    } else {
      this.newMonto = null;
    }
  }

  createOrder(): void {
    this.errorMessage = '';
    if (!this.newCliente || !this.newCliente.trim()) {
      this.errorMessage = 'Debe ingresar el nombre de la empresa o cliente.';
      return;
    }
    if (!this.selectedProductId) {
      this.errorMessage = 'Debe seleccionar un producto del catálogo.';
      return;
    }
    if (!this.selectedCantidad || this.selectedCantidad <= 0) {
      this.errorMessage = 'Debe ingresar una cantidad válida mayor a 0.';
      return;
    }

    const prod = this.products.find(p => Number(p.id) === Number(this.selectedProductId));
    if (!prod) {
      this.errorMessage = 'El producto seleccionado ya no existe en el catálogo.';
      return;
    }

    if (prod.stock < this.selectedCantidad) {
      this.errorMessage = `Stock insuficiente. Solo quedan ${prod.stock} unidades de ${prod.nombre}.`;
      return;
    }

    const calculatedMonto = prod.precio * this.selectedCantidad;

    const newOrderPayload: ExtendedOrder = {
      cliente: this.newCliente.trim(),
      monto: calculatedMonto,
      estado: 'CREADO',
      fecha: new Date().toISOString().split('T')[0],
      productoId: prod.id,
      productoNombre: prod.nombre,
      cantidad: this.selectedCantidad,
      detalleProductos: `${prod.nombre} (x${this.selectedCantidad})`
    };

    this.ordersService.createOrder(newOrderPayload).subscribe({
      next: (createdOrder) => {
        this.logSessionEvent(
          'OrderCreated',
          `Pedido #${createdOrder.id} creado para ${createdOrder.cliente} (${this.selectedCantidad}x ${prod.nombre}) por $${calculatedMonto.toLocaleString('es-CL')}`
        );

        this.newCliente = '';
        this.selectedProductId = null;
        this.selectedCantidad = 1;
        this.newMonto = null;
        this.showCreateForm = false;
        this.loadOrders();
      },
      error: (err) => {
        this.errorMessage = 'Error al registrar el pedido en Neon PostgreSQL.';
        console.error(err);
      }
    });
  }

  advanceStatus(order: ExtendedOrder): void {
    if (!order.id) return;

    const current = (order.estado || '').toUpperCase();
    const sequence: Record<string, OrderStatus> = {
      'CREADO': 'ACEPTADO',
      'PAGADO': 'EN_PREPARACIÓN',
      'ACEPTADO': 'EN_PREPARACIÓN',
      'EN_PREPARACIÓN': 'DESPACHADO',
      'DESPACHADO': 'ENTREGADO'
    };

    const nextState = sequence[current];
    if (!nextState) return;

    this.ordersService.updateStatus(order.id, nextState).subscribe({
      next: () => {
        if (nextState === 'ACEPTADO' && order.productoId) {
          const prod = this.products.find(p => Number(p.id) === Number(order.productoId));
          if (prod) {
            const qty = order.cantidad || 1;
            const updatedStock = Math.max(0, prod.stock - qty);
            this.ordersService.updateProduct(prod.id, { ...prod, stock: updatedStock }).subscribe({
              next: () => this.loadProducts()
            });
          }
        }

        this.logSessionEvent(
          `Order${nextState}`,
          `Pedido #${order.id} (${order.cliente}) cambió de ${current} a ${nextState}`
        );
        this.loadOrders();
      },
      error: (err) => {
        console.error('Error al actualizar estado en Neon DB:', err);
        this.openAlertModal('Error de Sincronización', `No se pudo actualizar el estado del Pedido #${order.id} en la base de datos.`);
      }
    });
  }

  cancelOrder(order: ExtendedOrder): void {
    if (!order.id) return;
    this.ordersService.updateStatus(order.id, 'CANCELADO').subscribe({
      next: () => {
        this.logSessionEvent('OrderCancelled', `Pedido #${order.id} (${order.cliente}) fue cancelado`);
        this.loadOrders();
      },
      error: (err) => {
        console.error('Error al cancelar pedido:', err);
        this.openAlertModal('Error', `No se pudo cancelar el Pedido #${order.id} en Neon DB.`);
      }
    });
  }

  deleteOrder(id?: number): void {
    if (!id) return;
    this.openConfirmModal(
      'Confirmar Eliminación',
      `¿Está seguro de que desea eliminar permanentemente el Pedido #${id} de la base de datos?`,
      () => {
        this.ordersService.deleteOrder(id).subscribe({
          next: () => {
            this.logSessionEvent('OrderDeleted', `Pedido #${id} eliminado de Neon DB`);
            this.loadOrders();
          },
          error: (err) => {
            console.error('Error al eliminar pedido:', err);
            this.openAlertModal('Error', `No se pudo eliminar el Pedido #${id} en el servidor.`);
          }
        });
      }
    );
  }

  startEdit(order: ExtendedOrder): void {
    this.editingOrderId = order.id || null;
    this.editCliente = order.cliente;
    this.editProductId = order.productoId || (this.products[0]?.id || null);
    this.editCantidad = order.cantidad || 1;
    this.editErrorMessage = '';
    this.recalculateEditMonto();
  }

  onEditProductOrCantidadChange(): void {
    this.editErrorMessage = '';
    this.recalculateEditMonto();
  }

  recalculateEditMonto(): void {
    const prod = this.products.find(p => Number(p.id) === Number(this.editProductId));
    if (prod) {
      this.editMonto = prod.precio * (this.editCantidad || 1);
    } else {
      this.editMonto = 0;
    }
  }

  cancelEdit(): void {
    this.editingOrderId = null;
    this.editErrorMessage = '';
  }

  saveEdit(order: ExtendedOrder): void {
    this.editErrorMessage = '';

    if (!this.editCliente.trim()) {
      this.editErrorMessage = 'Debe ingresar una empresa o cliente válido.';
      return;
    }
    if (!this.editCantidad || this.editCantidad <= 0) {
      this.editErrorMessage = 'Debe ingresar una cantidad mayor a 0.';
      return;
    }

    const prod = this.products.find(p => Number(p.id) === Number(this.editProductId));
    if (prod && this.editCantidad > prod.stock) {
      this.editErrorMessage = `Stock insuficiente. Solo quedan ${prod.stock} un. de ${prod.nombre}.`;
      return;
    }

    const updatedOrder: ExtendedOrder = {
      ...order,
      cliente: this.editCliente.trim(),
      productoId: prod ? prod.id : order.productoId,
      productoNombre: prod ? prod.nombre : order.productoNombre,
      cantidad: this.editCantidad,
      monto: prod ? this.editMonto : order.monto,
      detalleProductos: prod ? `${prod.nombre} (x${this.editCantidad})` : order.detalleProductos
    };

    if (order.id) {
      this.ordersService.updateOrder(order.id, updatedOrder).subscribe({
        next: () => {
          this.logSessionEvent('OrderUpdated', `Pedido #${order.id} actualizado (${updatedOrder.cliente})`);
          this.editingOrderId = null;
          this.loadOrders();
        },
        error: () => {
          Object.assign(order, updatedOrder);
          this.editingOrderId = null;
          this.cdr.detectChanges();
        }
      });
    }
  }

  toggleProdForm(): void {
    this.showProdForm = !this.showProdForm;
    this.prodErrorMessage = '';
  }

  createProduct(): void {
    this.prodErrorMessage = '';

    if (!this.newProdNombre || !this.newProdNombre.trim()) {
      this.prodErrorMessage = 'El nombre del producto no puede estar en blanco.';
      return;
    }
    if (!this.newProdPrecio || this.newProdPrecio <= 0) {
      this.prodErrorMessage = 'Debe ingresar un precio válido mayor a $0.';
      return;
    }
    if (this.newProdStock === null || this.newProdStock === undefined || this.newProdStock < 0) {
      this.prodErrorMessage = 'Debe ingresar un stock inicial válido (mínimo 0).';
      return;
    }

    const imagenUrl = this.newProdImagenUrl.trim();
    if (imagenUrl && !imagenUrl.startsWith('http://') && !imagenUrl.startsWith('https://')) {
      this.prodErrorMessage = 'La URL de la imagen debe comenzar con http:// o https://';
      return;
    }

    const payload: Partial<Product> = {
      nombre: this.newProdNombre.trim(),
      categoria: this.newProdCategoria.trim() || 'General',
      precio: Number(this.newProdPrecio),
      stock: Number(this.newProdStock),
      imagenUrl: imagenUrl || undefined,
      descripcion: this.newProdDescripcion.trim() || undefined
    };

    this.isSavingProduct = true;
    this.ordersService.createProduct(payload).subscribe({
      next: (created) => {
        this.isSavingProduct = false;
        this.logSessionEvent('ProductCreated', `Producto "${created.nombre}" agregado al catálogo de Neon DB`);
        this.newProdNombre = '';
        this.newProdCategoria = '';
        this.newProdPrecio = null;
        this.newProdStock = null;
        this.newProdImagenUrl = '';
        this.newProdDescripcion = '';
        this.showProdForm = false;
        this.loadProducts();
      },
      error: (err) => {
        this.isSavingProduct = false;
        this.prodErrorMessage = 'Error al guardar el producto en Neon PostgreSQL.';
        console.error(err);
      }
    });
  }

  startEditProduct(prod: Product): void {
    this.editingProductId = prod.id;
    this.editProdNombre = prod.nombre;
    this.editProdCategoria = prod.categoria;
    this.editProdPrecio = prod.precio;
    this.editProdStock = prod.stock;
    this.editProdImagenUrl = prod.imagenUrl || '';
    this.editProdDescripcion = prod.descripcion || '';
  }

  cancelEditProduct(): void {
    this.editingProductId = null;
  }

  saveEditProduct(prod: Product): void {
    if (
      !this.editProdNombre.trim() ||
      !this.editProdPrecio ||
      this.editProdPrecio <= 0 ||
      this.editProdStock === null ||
      this.editProdStock < 0
    ) {
      return;
    }

    const imagenUrl = this.editProdImagenUrl.trim();
    const payload: Partial<Product> = {
      id: prod.id,
      nombre: this.editProdNombre.trim(),
      categoria: this.editProdCategoria.trim() || 'General',
      precio: Number(this.editProdPrecio),
      stock: Number(this.editProdStock),
      imagenUrl: imagenUrl || undefined,
      descripcion: this.editProdDescripcion.trim() || undefined
    };

    this.ordersService.updateProduct(prod.id, payload).subscribe({
      next: () => {
        this.logSessionEvent('ProductUpdated', `Producto #${prod.id} (${payload.nombre}) actualizado en Neon DB`);
        this.editingProductId = null;
        this.loadProducts();
      },
      error: (err) => {
        console.error('Error al actualizar producto en Neon DB:', err);
        this.openAlertModal('Error al Guardar', `No se pudo actualizar "${prod.nombre}" en la base de datos.`);
      }
    });
  }

  deleteProduct(id: number): void {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    const hasActiveOrders = this.orders.some(
      o => Number(o.productoId) === Number(id) && o.estado !== 'ENTREGADO' && o.estado !== 'CANCELADO'
    );

    if (hasActiveOrders) {
      this.openAlertModal(
        'Acción Bloqueada',
        `No se puede eliminar "${prod.nombre}" porque tiene pedidos en curso pendientes de entrega.`
      );
      return;
    }

    this.openConfirmModal(
      'Confirmar Eliminación',
      `¿Está seguro de que desea eliminar el producto "${prod.nombre}" de Neon PostgreSQL?`,
      () => {
        this.ordersService.deleteProduct(id).subscribe({
          next: () => {
            this.logSessionEvent('ProductDeleted', `Producto #${id} (${prod.nombre}) eliminado del catálogo`);
            this.loadProducts();
          },
          error: (err) => {
            console.error('Error al eliminar producto:', err);
            this.openAlertModal('Error', `No se pudo eliminar "${prod.nombre}" en el servidor.`);
          }
        });
      }
    );
  }

  get validOrders(): ExtendedOrder[] {
    return this.orders.filter(o => (o.estado || '').toUpperCase() !== 'CANCELADO');
  }

  getTotalSales(): number {
    return this.validOrders.reduce((sum, o) => sum + (o.monto || 0), 0);
  }

  getActiveOrdersCount(): number {
    return this.orders.filter(o => {
      const st = (o.estado || '').toUpperCase();
      return st !== 'ENTREGADO' && st !== 'CANCELADO';
    }).length;
  }

  getCompletedOrdersCount(): number {
    return this.orders.filter(o => {
      const st = (o.estado || '').toUpperCase();
      return st === 'PAGADO' || st === 'ENTREGADO';
    }).length;
  }

  getAverageTicket(): number {
    const count = this.validOrders.length;
    return count > 0 ? Math.round(this.getTotalSales() / count) : 0;
  }

  get unifiedAuditLogs(): AuditLog[] {
    const dbEvents: AuditLog[] = this.orders.map(o => {
      const estado = (o.estado || 'CREADO').toUpperCase();
      const detalleProd = this.getOrderSummaryLabel(o);
      return {
        id: `db-order-${o.id}`,
        evento: `Order${estado.charAt(0) + estado.slice(1).toLowerCase()}`,
        usuario: o.cliente || 'Cliente Corporativo',
        timestamp: o.fecha || 'Registrado en Neon DB',
        detalle: `Pedido #${o.id} — ${detalleProd} — Monto: $${(o.monto || 0).toLocaleString('es-CL')} (Estado: ${estado})`,
        origen: 'DB'
      };
    });

    return [...this.sessionAuditLogs, ...dbEvents];
  }

  login(): void {
    this.msalService.loginRedirect(loginRequest);
  }

  logout(): void {
    this.msalService.logoutRedirect();
  }
}
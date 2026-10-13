import { Component, OnInit, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus, AuthenticationResult } from '@azure/msal-browser';
import { filter } from 'rxjs/operators';
import { loginRequest } from './auth-config';
import { OrdersService } from './services/orders.service';
import { Order } from './models/order.model';
import { CustomerViewComponent } from './components/customer-view/customer-view';

export interface Product {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  categoria: string;
}

export interface AuditLog {
  id: number;
  evento: string;
  usuario: string;
  timestamp: string;
  detalle: string;
}

export interface ExtendedOrder extends Order {
  productoId?: number;
  productoNombre?: string;
  cantidad?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomerViewComponent],
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
  // REGLA CRÍTICA: Por defecto SIEMPRE es Client
  userRole: 'Admin' | 'Client' = 'Client';
  activeTab = 'store';

  // Productos cargados dinámicamente desde Neon DB
  products: Product[] = [];
  orders: ExtendedOrder[] = [];

  auditLogs: AuditLog[] = [
    { id: 1, evento: 'OrderCreated', usuario: 'johao.riquelme@empresa.com', timestamp: '2026-03-03 10:15:02', detalle: 'Pedido #103 creado por $280.000' },
    { id: 2, evento: 'OrderAccepted', usuario: 'operador.admin@empresa.com', timestamp: '2026-03-03 10:18:40', detalle: 'Pedido #102 aceptado (Stock descontado)' }
  ];

  // Formulario Crear Pedido
  newCliente = '';
  selectedProductId: number | null = null;
  selectedCantidad: number = 1;
  newMonto: number | null = null;
  showCreateForm = false;
  errorMessage = '';

  // Formulario Crear Producto
  newProdNombre = '';
  newProdCategoria = '';
  newProdPrecio: number | null = null;
  newProdStock: number | null = null;
  showProdForm = false;
  prodErrorMessage = '';

  // Edición Producto (Catálogo)
  editingProductId: number | null = null;
  editProdNombre = '';
  editProdCategoria = '';
  editProdPrecio: number | null = null;
  editProdStock: number | null = null;

  // Edición Pedido (Pedidos)
  editingOrderId: number | null = null;
  editCliente = '';
  editProductId: number | null = null;
  editCantidad: number = 1;
  editMonto: number = 0;
  editErrorMessage = '';

  // Modal de Confirmación Personalizado
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

    this.loadOrders();
    this.loadProducts();

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

  loadOrders(): void {
    this.ordersService.getOrders().subscribe({
      next: (data) => {
        this.orders = data.map(o => ({
          ...o,
          monto: o.monto ?? o.total ?? 0
        }));
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
        this.products = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener productos de Neon DB:', err);
      }
    });
  }

  checkAccount() {
    if (!isPlatformBrowser(this.platformId)) return;

    const activeAccount = 
      this.msalService.instance.getActiveAccount() || 
      this.msalService.instance.getAllAccounts()[0];

    if (activeAccount) {
      this.msalService.instance.setActiveAccount(activeAccount);
      this.isLoggedIn = true;
      this.userName = activeAccount.name || activeAccount.username;

      const claims = activeAccount.idTokenClaims as any;

      // Unificamos la búsqueda del correo electrónico
      const rawEmail = (
        claims?.preferred_username || 
        claims?.email || 
        activeAccount.username || 
        ''
      ).toLowerCase().trim();

      // REGLA ABSOLUTA Y ESTRICTA:
      // SOLAMENTE si el correo es el tuyo (johao.riquelme / joh.riquelme) se otorga Admin.
      // Cualquier otro correo (incluyendo emi.parra@duocuc.cl) SERÁ 'Client'.
      if (rawEmail.includes('johao.riquelme') || rawEmail.includes('joh.riquelme')) {
        this.userRole = 'Admin';
      } else {
        this.userRole = 'Client';
        this.activeTab = 'store';
      }

      console.log('--- CONTROL DE ACCESO RBAC ---');
      console.log('Usuario detectado:', rawEmail);
      console.log('Rol final asignado:', this.userRole);
    } else {
      this.isLoggedIn = false;
      this.userRole = 'Client';
      this.activeTab = 'store';
    }

    this.cdr.detectChanges();
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  openConfirmModal(title: string, message: string, action: () => void) {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = 'confirm';
    this.onModalConfirm = action;
    this.showModal = true;
  }

  openAlertModal(title: string, message: string) {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = 'alert';
    this.onModalConfirm = null;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.onModalConfirm = null;
  }

  executeModalAction() {
    if (this.onModalConfirm) {
      this.onModalConfirm();
    }
    this.closeModal();
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    this.errorMessage = '';
  }

  onProductSelect() {
    const prod = this.products.find(p => Number(p.id) === Number(this.selectedProductId));
    if (prod) {
      this.newMonto = prod.precio * (this.selectedCantidad || 1);
    } else {
      this.newMonto = null;
    }
  }

  createOrder() {
    this.errorMessage = '';
    if (!this.newCliente || !this.newCliente.trim()) {
      this.errorMessage = 'Debe ingresar el nombre del cliente o empresa.';
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
      cantidad: this.selectedCantidad
    };

    this.ordersService.createOrder(newOrderPayload).subscribe({
      next: (createdOrder) => {
        this.orders.unshift({
          ...createdOrder,
          monto: createdOrder.monto ?? createdOrder.total ?? calculatedMonto,
          productoNombre: prod.nombre,
          cantidad: this.selectedCantidad
        });

        this.auditLogs.unshift({
          id: this.auditLogs.length + 1,
          evento: 'OrderCreated',
          usuario: this.userName || 'Usuario',
          timestamp: new Date().toLocaleString(),
          detalle: `Pedido #${createdOrder.id} creado para ${createdOrder.cliente} (${this.selectedCantidad}x ${prod.nombre}) por $${calculatedMonto}`
        });

        this.newCliente = '';
        this.selectedProductId = null;
        this.selectedCantidad = 1;
        this.newMonto = null;
        this.showCreateForm = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'Error al conectar con la base de datos en Neon.';
        console.error(err);
      }
    });
  }

  advanceStatus(order: ExtendedOrder) {
    if (order.estado === 'CREADO') {
      const prodExists = this.products.some(p => Number(p.id) === Number(order.productoId));
      if (!prodExists) {
        this.openAlertModal('Acción Bloqueada', `No se puede procesar el Pedido #${order.id} porque el producto original fue eliminado del catálogo.`);
        return;
      }
    }

    const sequence: Record<string, 'ACEPTADO' | 'EN_PREPARACIÓN' | 'DESPACHADO' | 'ENTREGADO'> = {
      'CREADO': 'ACEPTADO',
      'ACEPTADO': 'EN_PREPARACIÓN',
      'EN_PREPARACIÓN': 'DESPACHADO',
      'DESPACHADO': 'ENTREGADO'
    };

    if (sequence[order.estado]) {
      const oldState = order.estado;
      order.estado = sequence[order.estado];

      if (order.estado === 'ACEPTADO' && order.productoId) {
        const prod = this.products.find(p => Number(p.id) === Number(order.productoId));
        if (prod) {
          const qty = order.cantidad || 1;
          prod.stock = Math.max(0, prod.stock - qty);
        }
      }

      this.auditLogs.unshift({
        id: this.auditLogs.length + 1,
        evento: `Order${order.estado}`,
        usuario: this.userName || 'Usuario',
        timestamp: new Date().toLocaleString(),
        detalle: `Pedido #${order.id} cambió de ${oldState} a ${order.estado}`
      });
    }
  }

  cancelOrder(order: ExtendedOrder) {
    order.estado = 'CANCELADO';
    this.auditLogs.unshift({
      id: this.auditLogs.length + 1,
      evento: 'OrderCancelled',
      usuario: this.userName || 'Usuario',
      timestamp: new Date().toLocaleString(),
      detalle: `Pedido #${order.id} fue cancelado`
    });
  }

  deleteOrder(id?: number) {
    if (!id) return;
    this.openConfirmModal(
      'Confirmar Eliminación',
      `¿Está seguro de que desea eliminar el Pedido #${id}? Esta acción no se puede deshacer.`,
      () => {
        this.orders = this.orders.filter(o => o.id !== id);
        this.auditLogs.unshift({
          id: this.auditLogs.length + 1,
          evento: 'OrderDeleted',
          usuario: this.userName || 'Usuario',
          timestamp: new Date().toLocaleString(),
          detalle: `Pedido #${id} fue eliminado`
        });
      }
    );
  }

  startEdit(order: ExtendedOrder) {
    this.editingOrderId = order.id || null;
    this.editCliente = order.cliente;
    this.editProductId = order.productoId || (this.products[0]?.id || null);
    this.editCantidad = order.cantidad || 1;
    this.editErrorMessage = '';
    this.recalculateEditMonto();
  }

  onEditProductOrCantidadChange() {
    this.editErrorMessage = '';
    this.recalculateEditMonto();
  }

  recalculateEditMonto() {
    const prod = this.products.find(p => Number(p.id) === Number(this.editProductId));
    if (prod) {
      this.editMonto = prod.precio * (this.editCantidad || 1);
    } else {
      this.editMonto = 0;
    }
  }

  cancelEdit() {
    this.editingOrderId = null;
    this.editErrorMessage = '';
  }

  saveEdit(order: ExtendedOrder) {
    this.editErrorMessage = '';

    if (!this.editCliente.trim()) {
      this.editErrorMessage = 'Debe ingresar un cliente válido.';
      return;
    }
    if (!this.editCantidad || this.editCantidad <= 0) {
      this.editErrorMessage = 'Debe ingresar una cantidad mayor a 0.';
      return;
    }

    const prod = this.products.find(p => Number(p.id) === Number(this.editProductId));
    if (prod) {
      if (this.editCantidad > prod.stock) {
        this.editErrorMessage = `Stock insuficiente. Solo quedan ${prod.stock} un. de ${prod.nombre}.`;
        return;
      }
      order.productoId = prod.id;
      order.productoNombre = prod.nombre;
    }

    order.cliente = this.editCliente.trim();
    order.cantidad = this.editCantidad;
    order.monto = this.editMonto;

    this.editingOrderId = null;
    this.editErrorMessage = '';
  }

  toggleProdForm() {
    this.showProdForm = !this.showProdForm;
    this.prodErrorMessage = '';
  }

  createProduct() {
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

    const categoria = this.newProdCategoria && this.newProdCategoria.trim()
      ? this.newProdCategoria.trim()
      : 'General';

    this.products.push({
      id: this.products.length + 1,
      nombre: this.newProdNombre.trim(),
      precio: Number(this.newProdPrecio),
      stock: Number(this.newProdStock),
      categoria: categoria
    });

    this.newProdNombre = '';
    this.newProdCategoria = '';
    this.newProdPrecio = null;
    this.newProdStock = null;
    this.showProdForm = false;
  }

  startEditProduct(prod: Product) {
    this.editingProductId = prod.id;
    this.editProdNombre = prod.nombre;
    this.editProdCategoria = prod.categoria;
    this.editProdPrecio = prod.precio;
    this.editProdStock = prod.stock;
  }

  cancelEditProduct() {
    this.editingProductId = null;
  }

  saveEditProduct(prod: Product) {
    if (!this.editProdNombre.trim() || !this.editProdPrecio || this.editProdPrecio <= 0 || this.editProdStock === null || this.editProdStock < 0) {
      return;
    }

    prod.nombre = this.editProdNombre.trim();
    prod.categoria = this.editProdCategoria.trim() || 'General';
    prod.precio = Number(this.editProdPrecio);
    prod.stock = Number(this.editProdStock);

    this.editingProductId = null;
  }

  deleteProduct(id: number) {
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
      `¿Está seguro de que desea eliminar el producto "${prod.nombre}" del catálogo?`,
      () => {
        this.products = this.products.filter(p => p.id !== id);
      }
    );
  }

  getTotalSales(): number {
    return this.orders
      .filter(o => o.estado !== 'CANCELADO')
      .reduce((sum, o) => sum + (o.monto || 0), 0);
  }

  getActiveOrdersCount(): number {
    return this.orders.filter(o => o.estado !== 'ENTREGADO' && o.estado !== 'CANCELADO').length;
  }

  login() {
    this.msalService.loginRedirect(loginRequest);
  }

  logout() {
    this.msalService.logoutRedirect();
  }
}
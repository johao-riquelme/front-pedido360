import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

export interface ExtendedProduct extends Product {
  imagenUrl?: string;
  descripcion?: string;
}

export interface ExtendedCartItem {
  product: ExtendedProduct;
  quantity: number;
}

export interface ExtendedOrder extends Order {
  productoId?: number;
  productoNombre?: string;
  cantidad?: number;
  metodoPago?: string;
  detalleProductos?: string;
}

@Component({
  selector: 'app-customer-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-view.html',
  styleUrl: './customer-view.css'
})
export class CustomerViewComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);

  // Empresa activa: se conserva al terminar la compra y al recargar la página.
  // IMPORTANTE: para usuarios distintos en un mismo navegador se debe asociar la clave al usuario autenticado.
  private readonly empresaStorageKey = 'pedidos360_empresa_activa';
  private readonly cartStorageKey = 'pedidos360_carrito_en_proceso';
  private readonly pendingOrderStorageKey = 'pedidos360_orden_webpay_pendiente';

  products = signal<ExtendedProduct[]>([]);
  orders = signal<ExtendedOrder[]>([]);
  empresaNombre = signal<string>('');
  cart = signal<ExtendedCartItem[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  orderSuccess = signal<boolean>(false);
  lastOrderId = signal<number | null>(null);
  activeSubTab = signal<'catalog' | 'cart' | 'history'>('catalog');
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('');

  showCompanyModal = signal(false);
  companyDraft = signal('');
  companyModalError = signal('');
  pendingProduct = signal<ExtendedProduct | null>(null);
  paymentPending = signal(false);
  paymentReturnDetected = signal(false);
  paymentNotice = signal<string | null>(null);

  getRealProductImage(product: any): string {
    if (product?.imagenUrl && product.imagenUrl.startsWith('http') && !product.imagenUrl.includes('picsum')) {
      return product.imagenUrl;
    }

    const name = (product?.nombre || '').toLowerCase();

    if (name.includes('mouse') || name.includes('ratón') || name.includes('raton')) {
      return 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80';
    }
    if (name.includes('teclado') || name.includes('keyboard')) {
      return 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80';
    }
    if (name.includes('laptop') || name.includes('notebook') || name.includes('macbook') || name.includes('computador')) {
      return 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80';
    }
    if (name.includes('monitor') || name.includes('pantalla')) {
      return 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80';
    }
    if (name.includes('audifono') || name.includes('headphone') || name.includes('auricular')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
    }
    if (name.includes('silla') || name.includes('chair')) {
      return 'https://images.unsplash.com/photo-1580481072645-022f9a6d1270?w=800&auto=format&fit=crop&q=80';
    }
    
    return 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&auto=format&fit=crop&q=80';
  }

  getProductDescription(product: any): string {
    if (product?.descripcion) {
      return product.descripcion;
    }

    const name = (product?.nombre || '').toLowerCase();

    if (name.includes('mouse')) {
      return 'Sensor óptico de alta precisión, diseño ergonómico y conexión inalámbrica 2.4GHz de baja latencia.';
    }
    if (name.includes('teclado')) {
      return 'Switches mecánicos de alta durabilidad, retroiluminación y estructura reforzada para uso intensivo.';
    }
    if (name.includes('laptop') || name.includes('notebook')) {
      return 'Procesador de alto rendimiento, pantalla FHD y batería de larga duración ideal para trabajo corporativo.';
    }
    if (name.includes('monitor')) {
      return 'Panel IPS con colores nítidos, tasa de refresco fluida y filtro de protección ocular para largas jornadas.';
    }
    if (name.includes('audifono')) {
      return 'Aislamiento acústico pasivo, micrófono HD integrado y almohadillas confortables de memoria.';
    }

    return 'Equipamiento tecnológico corporativo de alta calidad con garantía y soporte directo.';
  }

  categories = computed(() => Array.from(new Set(
    this.products().map(p => p.categoria?.trim()).filter((c): c is string => !!c)
  )).sort((a, b) => a.localeCompare(b, 'es')));

  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.selectedCategory();
    return this.products().filter(p => {
      const nombre = (p.nombre || '').toLowerCase();
      const categoria = (p.categoria || '').toLowerCase();
      return (nombre.includes(query) || categoria.includes(query)) &&
             (!category || p.categoria === category);
    });
  });

  myCompanyOrders = computed(() => {
    const empresa = this.empresaNombre().toLocaleLowerCase('es').trim();
    if (!empresa) return [];
    // El filtrado visual no sustituye el control de acceso del backend.
    return this.orders().filter(order =>
      (order.cliente || '').toLocaleLowerCase('es').trim() === empresa
    );
  });

  totalAmount = computed(() => this.cart().reduce(
    (sum, item) => sum + (item.product.precio || 0) * item.quantity, 0
  ));

  totalItemsCount = computed(() => this.cart().reduce(
    (sum, item) => sum + item.quantity, 0
  ));

  ngOnInit(): void {
    this.restoreBrowserState();
    this.loadProducts();
    this.checkWebpayReturn();
    this.loadOrders();
  }

  private restoreBrowserState(): void {
    if (typeof window === 'undefined') return;
    try {
      this.empresaNombre.set(window.localStorage.getItem(this.empresaStorageKey) || '');
      const storedCart = window.sessionStorage.getItem(this.cartStorageKey);
      if (storedCart) {
        const parsed: unknown = JSON.parse(storedCart);
        if (Array.isArray(parsed)) {
          this.cart.set(parsed.filter((item: any) =>
            item && item.product && typeof item.product.id === 'number' &&
            typeof item.quantity === 'number' && item.quantity > 0
          ));
        }
      }
      const pendingId = Number(window.sessionStorage.getItem(this.pendingOrderStorageKey));
      if (pendingId > 0 && Number.isFinite(pendingId)) {
        this.lastOrderId.set(pendingId);
        this.paymentPending.set(true);
        this.paymentNotice.set(`Hay un pago pendiente de verificación para la orden #${pendingId}. Revisa su estado antes de modificar el carrito.`);
      }
    } catch (err) {
      console.warn('No fue posible restaurar el carrito:', err);
    }
  }

  private saveCart(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(this.cartStorageKey, JSON.stringify(this.cart()));
    } catch (err) {
      console.warn('No fue posible guardar el carrito:', err);
    }
  }

  private clearVerifiedPurchase(): void {
    this.cart.set([]);
    this.saveCart();
    this.paymentPending.set(false);
    this.paymentReturnDetected.set(false);
    this.paymentNotice.set(null);
    this.orderSuccess.set(true);
    this.activeSubTab.set('history');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(this.pendingOrderStorageKey);
    }
    this.loadProducts();
    // NO borrar empresaNombre: debe permanecer seleccionada.
  }

  checkWebpayReturn(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hasReturn = params.has('token_ws') || params.has('TBK_TOKEN') ||
      ['success', 'approved', 'failed', 'error'].includes((params.get('status') || '').toLowerCase());
    if (!hasReturn) return;

    this.paymentReturnDetected.set(true);
    this.activeSubTab.set('history');
    this.paymentNotice.set('Regresaste de Webpay. Estamos consultando el estado del pedido en el servidor; todavía no se considera pagado.');

    // No se interpreta token_ws ni status del navegador como prueba de pago.
    // Solo un pedido PAGADO confirmado por la API permite limpiar el carrito.
    ['token_ws', 'TBK_TOKEN', 'status'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  loadProducts(): void {
    this.ordersService.getProducts().subscribe({
      next: data => {
        if (!Array.isArray(data)) {
          this.products.set([]);
          return;
        }
        const mapped = data.map((p: any) => ({
          ...p,
          imagenUrl: this.getRealProductImage(p),
          descripcion: this.getProductDescription(p)
        }));
        this.products.set(mapped);
      },
      error: err => {
        console.error('Error productos:', err);
        this.errorMessage.set('Error al conectar con el catálogo en Neon DB.');
      }
    });
  }

  loadOrders(): void {
    this.ordersService.getOrders().subscribe({
      next: data => {
        if (!Array.isArray(data)) {
          this.orders.set([]);
          return;
        }
        const formatted: ExtendedOrder[] = data.map((o: any) => ({
          ...o,
          cliente: o.cliente || 'Empresa No Especificada',
          monto: o.monto ?? o.total ?? 0,
          metodoPago: o.metodoPago || 'Webpay Transbank',
          detalleProductos: o.detalleProductos || o.productoNombre || 'Detalle no especificado'
        }));
        this.orders.set(formatted);
        this.verifyPendingOrder(formatted);
      },
      error: err => {
        console.error('Error pedidos:', err);
        this.errorMessage.set('Error al cargar pedidos desde Neon DB.');
      }
    });
  }

  private verifyPendingOrder(allOrders: ExtendedOrder[]): void {
    if (!this.paymentPending()) return;
    const orderId = this.lastOrderId();
    if (orderId == null) return;
    const order = allOrders.find(o => Number(o.id) === Number(orderId));
    if (!order) {
      if (this.paymentReturnDetected()) {
        this.paymentNotice.set('No fue posible verificar la orden todavía. Usa «Sincronizar DB»; el carrito permanece guardado.');
      }
      return;
    }
    const status = String(order.estado || '').toUpperCase();
    if (['PAGADO', 'ENTREGADO', 'APROBADO', 'AUTORIZADO'].includes(status)) {
      this.clearVerifiedPurchase();
    } else if (['CANCELADO', 'RECHAZADO', 'ANULADO'].includes(status)) {
      // El servidor confirmó que NO se pagó: liberar el bloqueo, conservando carrito y empresa.
      this.paymentPending.set(false);
      this.paymentReturnDetected.set(false);
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(this.pendingOrderStorageKey);
      this.paymentNotice.set('El servidor informa que el pago no fue aprobado. Se conservó tu carrito y empresa; puedes volver a intentarlo.');
    } else if (this.paymentReturnDetected()) {
      this.paymentNotice.set(`La orden #${orderId} figura como «${status}» en la API. Aún no podemos confirmar el pago. Sincroniza el historial después de que el backend procese Webpay.`);
    }
  }

  setSubTab(tab: 'catalog' | 'cart' | 'history'): void {
    this.activeSubTab.set(tab);
    if (tab === 'history') this.loadOrders();
  }

  addToCart(product: ExtendedProduct): void {
    if (this.loading() || this.paymentPending()) {
      this.errorMessage.set('Hay un pago pendiente de verificación. No modifiques el carrito hasta confirmar su estado.');
      return;
    }
    if (product.stock <= 0) return;
    if (!this.empresaNombre().trim()) {
      this.pendingProduct.set(product);
      this.companyDraft.set('');
      this.companyModalError.set('');
      this.showCompanyModal.set(true);
      return;
    }
    this.addProductInternal(product);
  }

  private addProductInternal(product: ExtendedProduct): void {
    this.errorMessage.set(null);
    const existing = this.cart().find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        this.errorMessage.set(`Stock máximo alcanzado (${product.stock} un.) para ${product.nombre}.`);
        return;
      }
      this.cart.update(items => items.map(item => item.product.id === product.id
        ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      this.cart.update(items => [...items, { product, quantity: 1 }]);
    }
    this.saveCart();
  }

  requestCompanyChange(): void {
    if (this.cart().length > 0 || this.loading() || this.paymentPending()) {
      this.errorMessage.set('Para cambiar de empresa, primero debes dejar el carrito vacío y no tener pagos pendientes.');
      return;
    }
    this.pendingProduct.set(null);
    this.companyDraft.set(this.empresaNombre());
    this.companyModalError.set('');
    this.showCompanyModal.set(true);
  }

  confirmCompany(): void {
    const company = this.companyDraft().trim().replace(/\s+/g, ' ');
    if (company.length < 2 || company.length > 120) {
      this.companyModalError.set('Ingresa una razón social válida (entre 2 y 120 caracteres).');
      return;
    }
    if (this.cart().length > 0 || this.paymentPending()) {
      this.companyModalError.set('No es posible cambiar la empresa con productos o pagos pendientes.');
      return;
    }
    this.empresaNombre.set(company);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.empresaStorageKey, company);
    }
    const product = this.pendingProduct();
    this.cancelCompanyModal();
    this.errorMessage.set(null);
    if (product) this.addProductInternal(product);
  }

  cancelCompanyModal(): void {
    this.showCompanyModal.set(false);
    this.companyDraft.set('');
    this.companyModalError.set('');
    this.pendingProduct.set(null);
  }

  updateQuantity(productId: number | undefined, delta: number): void {
    if (productId == null || this.loading() || this.paymentPending()) return;
    const item = this.cart().find(i => i.product.id === productId);
    if (!item) return;
    const qty = item.quantity + delta;
    if (qty > item.product.stock) {
      this.errorMessage.set(`No puedes superar las ${item.product.stock} unidades disponibles.`);
      return;
    }
    this.cart.update(items => qty <= 0
      ? items.filter(i => i.product.id !== productId)
      : items.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
    this.saveCart();
  }

  removeFromCart(productId?: number): void {
    if (productId == null || this.loading() || this.paymentPending()) return;
    this.cart.update(items => items.filter(item => item.product.id !== productId));
    this.saveCart();
  }

  payWithWebpay(): void {
    if (this.loading() || this.paymentPending() || this.cart().length === 0) return;
    if (!this.empresaNombre().trim()) {
      this.errorMessage.set('Debes seleccionar una empresa antes de realizar el pago.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const detalleString = this.cart()
      .map(item => `${item.product.nombre} (x${item.quantity})`).join(', ');
    const firstItem = this.cart()[0];

    const orderPayload: ExtendedOrder = {
      cliente: this.empresaNombre().trim(),
      monto: this.totalAmount(),
      estado: 'CREADO',
      fecha: new Date().toISOString().split('T')[0],
      productoId: firstItem.product.id,
      productoNombre: firstItem.product.nombre,
      cantidad: this.totalItemsCount(),
      metodoPago: 'Webpay Transbank',
      detalleProductos: detalleString
    };

    this.ordersService.createOrder(orderPayload).subscribe({
      next: createdOrder => {
        if (createdOrder.id == null) {
          this.loading.set(false);
          this.errorMessage.set('La API no devolvió el ID del pedido. No se inició Webpay.');
          return;
        }
        this.lastOrderId.set(Number(createdOrder.id));
        const paymentPayload = {
          orderId: createdOrder.id,
          amount: this.totalAmount(),
          totalAmount: this.totalAmount(),
          items: this.cart().map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.precio
          }))
        };

        this.paymentService.initiateWebpay(paymentPayload).subscribe({
          next: (res: any) => {
            const webpayUrl = res?.url || res?.urlWebpay;
            const webpayToken = res?.token || res?.token_ws;
            if (!webpayUrl || !webpayToken) {
              this.loading.set(false);
              this.errorMessage.set('Webpay no devolvió una URL y token válidos. No se confirmó el pago.');
              return;
            }
            this.paymentPending.set(true);
            this.saveCart();
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(this.pendingOrderStorageKey, String(createdOrder.id));
            }
            try {
              this.paymentService.redirectToWebpay(webpayUrl, webpayToken);
            } catch (err) {
              this.paymentPending.set(false);
              this.loading.set(false);
              if (typeof window !== 'undefined') window.sessionStorage.removeItem(this.pendingOrderStorageKey);
              this.errorMessage.set('No fue posible redirigir a Webpay. No se confirmó el pago.');
            }
          },
          error: err => {
            this.loading.set(false);
            console.error('Error Webpay API:', err);
            this.errorMessage.set('Error al iniciar Webpay. No se confirmó el pago y se conservó el carrito.');
          }
        });
      },
      error: err => {
        this.loading.set(false);
        console.error('Error orden Neon DB:', err);
        this.errorMessage.set('No se pudo registrar la orden en Neon DB.');
      }
    });
  }

  closeSuccessModal(): void {
    this.orderSuccess.set(false);
    this.setSubTab('history');
  }
}

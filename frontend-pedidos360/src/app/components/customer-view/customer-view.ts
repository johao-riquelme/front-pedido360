import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

export interface ExtendedProduct extends Product {
  imagenUrl?: string;
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

  // Estado reactivo
  products = signal<ExtendedProduct[]>([]);
  orders = signal<ExtendedOrder[]>([]);
  empresaNombre = signal<string>('');
  cart = signal<ExtendedCartItem[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  orderSuccess = signal<boolean>(false);
  lastOrderId = signal<number | null>(null);

  activeSubTab = signal<'catalog' | 'history'>('catalog');
  searchQuery = signal<string>('');

  defaultProductImg = 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=150&auto=format&fit=crop&q=80';

  // Helper para resolver la imagen sin errores de tipos en la plantilla HTML
  getProductImage(product: any): string {
    return product?.imagenUrl || this.defaultProductImg;
  }

  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const prods = this.products() || [];
    
    return prods.filter(p => {
      const nombreMatches = p?.nombre ? p.nombre.toLowerCase().includes(query) : false;
      const catMatches = p?.categoria ? p.categoria.toLowerCase().includes(query) : false;
      return nombreMatches || catMatches;
    });
  });

  myCompanyOrders = computed(() => {
    const emp = this.empresaNombre().toLowerCase().trim();
    if (!emp) return []; 
    
    const allOrders = this.orders() || [];
    return allOrders.filter(o => o?.cliente && o.cliente.toLowerCase().includes(emp));
  });

  totalAmount = computed(() => {
    return (this.cart() || []).reduce((acc, item) => acc + ((item.product?.precio || 0) * item.quantity), 0);
  });

  totalItemsCount = computed(() => {
    return (this.cart() || []).reduce((acc, item) => acc + item.quantity, 0);
  });

  ngOnInit(): void {
    this.loadProducts();
    this.loadOrders();
    this.checkWebpayReturn();
  }

  checkWebpayReturn(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenWs = urlParams.get('token_ws');
    const status = urlParams.get('status');

    if (tokenWs || status === 'success' || status === 'approved') {
      this.orderSuccess.set(true);
      this.loadOrders();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  loadProducts(): void {
    this.ordersService.getProducts().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((p: any, idx: number) => ({
            ...p,
            imagenUrl: p.imagenUrl || `https://picsum.photos/seed/prod-${p.id || idx + 1}/150/150`
          }));
          this.products.set(mapped);
        } else {
          this.products.set([]);
        }
      },
      error: (err) => {
        console.error('Error productos:', err);
        this.errorMessage.set('Error al conectar con el catálogo en Neon DB.');
      }
    });
  }

  loadOrders(): void {
    this.ordersService.getOrders().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((o: any) => ({
            ...o,
            cliente: o.cliente || 'Empresa No Especificada',
            monto: o.monto ?? o.total ?? 0,
            metodoPago: o.metodoPago || 'Webpay Transbank',
            detalleProductos: o.detalleProductos || o.productoNombre || 'Detalle no especificado'
          }));
          this.orders.set(formatted);
        } else {
          this.orders.set([]);
        }
      },
      error: (err) => {
        console.error('Error pedidos:', err);
        this.errorMessage.set('Error al cargar pedidos desde Neon DB.');
      }
    });
  }

  setSubTab(tab: 'catalog' | 'history'): void {
    this.activeSubTab.set(tab);
    if (tab === 'history') {
      this.loadOrders();
    }
  }

  addToCart(product: ExtendedProduct): void {
    if (!this.empresaNombre().trim()) {
      this.errorMessage.set('⚠️ Debe ingresar el nombre de su empresa en el panel superior antes de agregar productos.');
      return;
    }

    this.errorMessage.set(null);
    const currentCart = [...this.cart()];
    const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      if (currentCart[existingIndex].quantity < product.stock) {
        currentCart[existingIndex].quantity++;
        this.cart.set(currentCart);
      } else {
        this.errorMessage.set(`⚠️ Stock máximo alcanzado (${product.stock} un.) para ${product.nombre}.`);
      }
    } else {
      currentCart.push({ product, quantity: 1 });
      this.cart.set(currentCart);
    }
  }

  updateQuantity(productId: number | undefined, delta: number): void {
    if (!productId) return;

    const currentCart = [...this.cart()];
    const index = currentCart.findIndex(item => item.product.id === productId);

    if (index > -1) {
      const prod = currentCart[index].product;
      const newQty = currentCart[index].quantity + delta;

      if (newQty <= 0) {
        currentCart.splice(index, 1);
      } else if (newQty <= prod.stock) {
        currentCart[index].quantity = newQty;
      }
      this.cart.set(currentCart);
    }
  }

  removeFromCart(productId?: number): void {
    this.cart.set(this.cart().filter(item => item.product.id !== productId));
  }

  payWithWebpay(): void {
    if (this.cart().length === 0) return;

    if (!this.empresaNombre().trim()) {
      this.errorMessage.set('⚠️ Debe ingresar el nombre de la empresa antes de procesar el pago.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const detalleString = this.cart()
      .map(item => `${item.product.nombre} (x${item.quantity})`)
      .join(', ');

    const firstItem = this.cart()[0];

    const orderPayload: ExtendedOrder = {
      cliente: this.empresaNombre().trim(),
      monto: this.totalAmount(),
      estado: 'CREADO',
      fecha: new Date().toISOString().split('T')[0],
      productoId: firstItem?.product.id,
      productoNombre: firstItem?.product.nombre,
      cantidad: this.totalItemsCount(),
      metodoPago: 'Webpay Transbank',
      detalleProductos: detalleString
    };

    this.ordersService.createOrder(orderPayload).subscribe({
      next: (createdOrder) => {
        this.lastOrderId.set(createdOrder.id || Math.floor(Math.random() * 1000));

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
            this.loading.set(false);
            const webpayUrl = res?.url || res?.urlWebpay;
            const webpayToken = res?.token || res?.token_ws;

            if (webpayUrl && webpayToken) {
              this.paymentService.redirectToWebpay(webpayUrl, webpayToken);
            } else {
              this.orderSuccess.set(true);
              this.cart.set([]);
              this.loadProducts();
            }
          },
          error: (err) => {
            this.loading.set(false);
            console.error('Error Webpay API:', err);
            this.orderSuccess.set(true);
            this.cart.set([]);
            this.loadProducts();
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error orden Neon DB:', err);
        this.errorMessage.set('No se pudo registrar la orden en Neon DB.');
      }
    });
  }

  closeSuccessModal(): void {
    this.orderSuccess.set(false);
  }
}
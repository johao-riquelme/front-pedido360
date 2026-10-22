import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../models/product.model';
import { CartItem } from '../../models/cart.model';
import { Order } from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

export interface ExtendedOrder extends Order {
  productoNombre?: string;
  cantidad?: number;
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

  // Datos desde Neon DB
  products = signal<Product[]>([]);
  orders = signal<ExtendedOrder[]>([]);

  // Carrito y Estado UI
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Navegación interna: 'catalog' | 'history'
  activeSubTab = signal<'catalog' | 'history'>('catalog');

  searchQuery = signal<string>('');

  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.products().filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      (p.categoria && p.categoria.toLowerCase().includes(query))
    );
  });

  totalAmount = computed(() => {
    return this.cart().reduce((acc, item) => acc + (item.product.precio * item.quantity), 0);
  });

  totalItemsCount = computed(() => {
    return this.cart().reduce((acc, item) => acc + item.quantity, 0);
  });

  ngOnInit(): void {
    this.loadProducts();
    this.loadOrders();
  }

  loadProducts(): void {
    this.ordersService.getProducts().subscribe({
      next: (data) => this.products.set(data),
      error: () => this.errorMessage.set('Error al cargar productos desde Neon DB.')
    });
  }

  loadOrders(): void {
    this.ordersService.getOrders().subscribe({
      next: (data) => {
        const formatted = data.map(o => ({
          ...o,
          monto: o.monto ?? o.total ?? 0
        }));
        this.orders.set(formatted);
      },
      error: () => this.errorMessage.set('Error al cargar historial de pedidos desde Neon DB.')
    });
  }

  setSubTab(tab: 'catalog' | 'history'): void {
    this.activeSubTab.set(tab);
    if (tab === 'history') {
      this.loadOrders();
    }
  }

  addToCart(product: Product): void {
    const currentCart = this.cart();
    const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      if (currentCart[existingIndex].quantity < product.stock) {
        currentCart[existingIndex].quantity++;
        this.cart.set([...currentCart]);
      }
    } else {
      this.cart.set([...currentCart, { product, quantity: 1 }]);
    }
  }

  removeFromCart(productId?: number): void {
    this.cart.set(this.cart().filter(item => item.product.id !== productId));
  }

  payWithWebpay(): void {
    if (this.cart().length === 0) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const payload = {
      items: this.cart().map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.precio
      })),
      totalAmount: this.totalAmount()
    };

    this.paymentService.initiateWebpay(payload).subscribe({
      next: (res) => {
        this.paymentService.redirectToWebpay(res.url, res.token);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo iniciar el pago con Webpay.');
      }
    });
  }
}
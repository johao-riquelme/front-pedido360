import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../models/product.model';
import { CartItem } from '../../models/cart.model';
import { Order } from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

export interface ExtendedOrder extends Order {
  productoId?: number;
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

  // Datos de Neon DB
  products = signal<Product[]>([]);
  orders = signal<ExtendedOrder[]>([]);

  // Empresa / Cliente
  empresaNombre = signal<string>('');

  // Carrito y Estados
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  orderSuccess = signal<boolean>(false);
  lastOrderId = signal<number | null>(null);

  // Navegación
  activeSubTab = signal<'catalog' | 'history'>('catalog');
  searchQuery = signal<string>('');

  // Productos filtrados para la tabla
  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.products().filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      (p.categoria && p.categoria.toLowerCase().includes(query))
    );
  });

  // El filtro SOLO se activa si existe un nombre de empresa ingresado. Si está vacío, retorna array vacío [].
  myCompanyOrders = computed(() => {
    const emp = this.empresaNombre().toLowerCase().trim();
    if (!emp) return []; 
    return this.orders().filter(o => o.cliente.toLowerCase().includes(emp));
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
      error: () => this.errorMessage.set('Error al conectar con el catálogo en Neon DB.')
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
      error: () => this.errorMessage.set('Error al cargar pedidos desde Neon DB.')
    });
  }

  setSubTab(tab: 'catalog' | 'history'): void {
    this.activeSubTab.set(tab);
    if (tab === 'history') {
      this.loadOrders();
    }
  }

  addToCart(product: Product): void {
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

  updateQuantity(productId: number, delta: number): void {
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

    // 1. Descontar stock localmente
    const updatedProducts = [...this.products()];
    this.cart().forEach(cartItem => {
      const prod = updatedProducts.find(p => p.id === cartItem.product.id);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - cartItem.quantity);
      }
    });
    this.products.set(updatedProducts);

    // 2. Guardar Pedido en Neon DB
    const firstItem = this.cart()[0];
    const orderPayload: ExtendedOrder = {
      cliente: this.empresaNombre().trim(),
      monto: this.totalAmount(),
      estado: 'CREADO',
      fecha: new Date().toISOString().split('T')[0],
      productoId: firstItem?.product.id,
      productoNombre: firstItem?.product.nombre,
      cantidad: this.totalItemsCount()
    };

    this.ordersService.createOrder(orderPayload).subscribe({
      next: (createdOrder) => {
        this.lastOrderId.set(createdOrder.id || Math.floor(Math.random() * 1000));
        this.orders.set([createdOrder, ...this.orders()]);

        // 3. Conectar Pasarela Transbank Webpay
        const paymentPayload = {
          orderId: createdOrder.id,
          items: this.cart().map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.precio
          })),
          totalAmount: this.totalAmount()
        };

        this.paymentService.initiateWebpay(paymentPayload).subscribe({
          next: (res) => {
            this.loading.set(false);
            this.orderSuccess.set(true);
            this.cart.set([]);
            if (res && res.url) {
              setTimeout(() => {
                this.paymentService.redirectToWebpay(res.url, res.token);
              }, 2500);
            }
          },
          error: () => {
            this.loading.set(false);
            this.orderSuccess.set(true);
            this.cart.set([]);
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Error al registrar la orden en Neon DB.');
        console.error(err);
      }
    });
  }

  closeSuccessModal(): void {
    this.orderSuccess.set(false);
  }
}
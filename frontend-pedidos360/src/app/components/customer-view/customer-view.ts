import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Product } from '../../models/product.model';
import { CartItem } from '../../models/cart.model';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-customer-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-view.html',
  styleUrl: './customer-view.css'
})
export class CustomerViewComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private route = inject(ActivatedRoute);

  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Recalcula automáticamente la suma total de todos los productos e ítems en el carrito
  totalAmount = computed(() => {
    return this.cart().reduce((acc, item) => acc + (item.product.precio * item.quantity), 0);
  });

  ngOnInit(): void {
    this.loadProducts();

    this.route.queryParams.subscribe(params => {
      const status = params['payment'];
      
      if (status === 'success') {
        this.successMessage.set(`¡Pago exitoso! Tu orden es: ${params['buyOrder']}`);
        this.cart.set([]);
        this.errorMessage.set(null);
      } else if (status === 'aborted') {
        this.errorMessage.set('Cancelaste el pago en Transbank.');
      } else if (status === 'rejected') {
        this.errorMessage.set('El pago fue rechazado por tu banco.');
      } else if (status === 'error') {
        this.errorMessage.set('Ocurrió un error en la pasarela de pagos.');
      }
    });
  }

  loadProducts(): void {
    this.ordersService.getProducts().subscribe({
      next: (data) => this.products.set(data),
      error: () => this.errorMessage.set('Error al cargar el catálogo de productos.')
    });
  }

  addToCart(product: Product): void {
    this.cart.update(currentCart => {
      const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

      if (existingIndex > -1) {
        return currentCart.map((item, index) =>
          index === existingIndex && item.quantity < product.stock
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { product, quantity: 1 }];
    });
  }

  removeFromCart(productId?: number): void {
    this.cart.set(this.cart().filter(item => item.product.id !== productId));
  }

  payWithWebpay(): void {
    if (this.cart().length === 0) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Payload compatible con las distintas formas en que el backend Java puede recibir el carrito
    const payload = {
      items: this.cart().map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        cantidad: item.quantity,
        price: item.product.precio,
        precio: item.product.precio
      })),
      amount: this.totalAmount(),
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
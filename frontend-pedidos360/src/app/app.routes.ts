import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
// Asegúrate de que la ruta relativa coincida con el nombre de tu componente exportado
import { CustomerViewComponent } from './components/customer-view/customer-view'; 

export const routes: Routes = [
  { 
    path: 'customer', 
    component: CustomerViewComponent, 
    canActivate: [MsalGuard] 
  },
  // Tus otras rutas existentes (dashboard, pedidos, etc.)
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
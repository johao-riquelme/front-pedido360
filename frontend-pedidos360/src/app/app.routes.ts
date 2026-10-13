import { Routes } from '@angular/router';
import { CustomerViewComponent } from './components/customer-view/customer-view';

export const routes: Routes = [
  { path: '', redirectTo: 'tienda', pathMatch: 'full' },
  { path: 'tienda', component: CustomerViewComponent }
];
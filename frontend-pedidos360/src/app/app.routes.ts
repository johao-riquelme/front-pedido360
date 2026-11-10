import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { CustomerViewComponent } from './components/customer-view/customer-view';

export const routes: Routes = [
  { path: '', redirectTo: 'customer', pathMatch: 'full' },
  {
    path: 'customer',
    component: CustomerViewComponent,
    canActivate: [MsalGuard]
  },
  { path: '**', redirectTo: 'customer' }
];

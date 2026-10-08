import { IPublicClientApplication, PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';

export const msalConfig = {
  auth: {
    clientId: 'a17cda30-9d3b-4af4-8bfe-75e8ad13aa24',
    authority: 'https://login.microsoftonline.com/fd7c1051-f107-4307-a49d-b7901ba3e873',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : 'https://35.172.182.199.sslip.io/'
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

export const loginRequest = {
  scopes: ['api://a17cda30-9d3b-4af4-8bfe-75e8ad13aa24/Orders.Read']
};

export const protectedResources = {
  ordersApi: {
    endpoint: '/api/orders', // Cambiado a ruta relativa para que MSAL inyecte el Token a través de Nginx
    scopes: ['api://a17cda30-9d3b-4af4-8bfe-75e8ad13aa24/Orders.Read']
  }
};

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: loginRequest
  };
}

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap: new Map([
      [protectedResources.ordersApi.endpoint, protectedResources.ordersApi.scopes]
    ])
  };
}
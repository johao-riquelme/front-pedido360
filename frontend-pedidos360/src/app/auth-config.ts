import { IPublicClientApplication, PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';

export const msalConfig = {
  auth: {
    clientId: 'a17cda30-9d3b-4af4-8bfe-75e8ad13aa24',
    authority: 'https://login.microsoftonline.com/fd7c1051-f107-4307-a49d-b7901ba3e873',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://54.87.38.87/'
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
    endpoint: 'http://localhost:8080/api/orders',
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
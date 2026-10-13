import { 
  IPublicClientApplication, 
  PublicClientApplication, 
  InteractionType, 
  Configuration 
} from '@azure/msal-browser';
import { 
  MsalGuardConfiguration, 
  MsalInterceptorConfiguration 
} from '@azure/msal-angular';

export const msalConfig: Configuration = {
  auth: {
    clientId: 'a17cda30-9d3b-4af4-8bfe-75e8ad13aa24',
    authority: 'https://login.microsoftonline.com/fd7c1051-f107-4307-a49d-b7901ba3e873',
    redirectUri: 'https://13.218.231.206.sslip.io'
  },
  cache: {
    cacheLocation: 'localStorage'
  }
};

export const loginRequest = {
  scopes: ['User.Read']
};

export const protectedResources = {
  ordersApi: {
    endpoint: '/api/orders',
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

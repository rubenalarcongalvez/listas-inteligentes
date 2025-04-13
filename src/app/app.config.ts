import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideAnimationsAsync(),
    providePrimeNG({
      theme: {
          preset: Lara,
          options: {
            cssLayer: {
              name: 'primeng',
            }
          },
      }
    }), provideFirebaseApp(() => initializeApp({ projectId: "miscellaneous-fts", appId: "1:852596679231:web:7484e51b667cc88cde4e8a", storageBucket: "miscellaneous-fts.firebasestorage.app", apiKey: "AIzaSyD-LQSRgvUBtAQP4-nXc4gbf6f91DTSQ34", authDomain: "miscellaneous-fts.firebaseapp.com", messagingSenderId: "852596679231", measurementId: "G-E40VM25WZG" })), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())
  ]
};

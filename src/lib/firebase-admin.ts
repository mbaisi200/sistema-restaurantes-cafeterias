import admin from 'firebase-admin';

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;
let initialized = false;
let initError: string | null = null;

function initializeAdmin() {
  if (initialized) return;
  initialized = true;

  try {
    // Se já estiver inicializado, usar a instância existente
    if (admin.apps.length > 0) {
      adminAuth = admin.auth();
      adminDb = admin.firestore();
      return;
    }

    // Tentar obter a service account do ambiente
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      initError = 'FIREBASE_SERVICE_ACCOUNT_KEY não configurada';
      console.warn('Firebase Admin: Configure a variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY');
      return;
    }

    // Parsear a service account
    const serviceAccount = JSON.parse(serviceAccountKey);

    // Inicializar o Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    adminAuth = admin.auth();
    adminDb = admin.firestore();

    console.log('Firebase Admin inicializado com sucesso');

  } catch (error) {
    initError = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

// Inicializar na primeira importação
initializeAdmin();

export { adminAuth, adminDb, initError };
export default admin;

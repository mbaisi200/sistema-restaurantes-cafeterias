import admin from 'firebase-admin';

// Verificar se já foi inicializado
if (!admin.apps.length) {
  // Tentar inicializar com as credenciais do ambiente
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Se não tiver service account, usar as credenciais padrão do Google Cloud
    // Isso funciona em ambientes como Google Cloud Run, Cloud Functions, etc.
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } catch (error) {
      console.warn('Firebase Admin não inicializado: credenciais não configuradas');
    }
  }
}

export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;
export default admin;

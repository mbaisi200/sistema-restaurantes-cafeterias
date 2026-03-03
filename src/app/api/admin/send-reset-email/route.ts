import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Inicializar Firebase app se ainda não estiver inicializado
function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validações
    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Inicializar Firebase
    const app = getFirebaseApp();
    const auth = getAuth(app);

    // Enviar email de redefinição de senha
    await sendPasswordResetEmail(auth, email);

    return NextResponse.json({
      success: true,
      message: 'Email de redefinição de senha enviado com sucesso',
    });

  } catch (error: unknown) {
    console.error('Erro ao enviar email de redefinição:', error);
    
    let errorMessage = 'Erro ao enviar email de redefinição';
    if (error instanceof Error) {
      // Traduzir erros comuns do Firebase
      if (error.message.includes('user-not-found')) {
        errorMessage = 'Usuário não encontrado com este email';
      } else if (error.message.includes('invalid-email')) {
        errorMessage = 'Email inválido';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

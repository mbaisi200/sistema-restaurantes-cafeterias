import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, initError } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, newPassword } = body;

    // Validações
    if (!uid || !newPassword) {
      return NextResponse.json(
        { error: 'UID e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se o Firebase Admin está inicializado
    if (!adminAuth) {
      return NextResponse.json(
        { error: `Firebase Admin não configurado: ${initError || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }

    // Atualizar a senha do usuário
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso',
    });

  } catch (error: unknown) {
    console.error('Erro ao redefinir senha:', error);

    let errorMessage = 'Erro ao redefinir senha';
    if (error instanceof Error) {
      // Traduzir erros comuns
      if (error.message.includes('auth/user-not-found')) {
        errorMessage = 'Usuário não encontrado no Firebase Authentication';
      } else if (error.message.includes('auth/invalid-password')) {
        errorMessage = 'Senha inválida. Deve ter pelo menos 6 caracteres';
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

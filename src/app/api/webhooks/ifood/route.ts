/**
 * Webhook iFood
 * 
 * Endpoint para receber eventos do iFood:
 * - Novos pedidos
 * - Atualizações de status
 * - Testes de conexão
 * 
 * URL: /api/webhooks/ifood
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  processIFoodOrder, 
  getIFoodConfig, 
  logIFoodEvent 
} from '@/services/ifood-service';
import { 
  IFoodWebhookEvent, 
  IFoodOrder, 
  IFoodOrderStatusUpdate,
  IFoodOrderStatus
} from '@/types/ifood';

// Verificar assinatura do webhook (quando implementado pelo iFood)
function verifyWebhookSignature(request: NextRequest): boolean {
  // TODO: Implementar verificação de assinatura quando o iFood disponibilizar
  // const signature = request.headers.get('x-ifood-signature');
  // return verifySignature(signature, body);
  return true;
}

// Handler para POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[iFood Webhook] Evento recebido:', JSON.stringify(body, null, 2));

    // Verificar assinatura
    if (!verifyWebhookSignature(request)) {
      console.error('[iFood Webhook] Assinatura inválida');
      return NextResponse.json(
        { error: 'Assinatura inválida' },
        { status: 401 }
      );
    }

    const event = body as IFoodWebhookEvent;

    // Processar baseado no tipo de evento
    switch (event.event) {
      case 'ORDER_PLACED':
      case 'ORDER_CREATED':
        return await handleNewOrder(event.data as IFoodOrder);
      
      case 'ORDER_STATUS_CHANGED':
      case 'ORDER_UPDATED':
        return await handleStatusUpdate(event.data as IFoodOrderStatusUpdate);
      
      case 'TEST':
        return await handleTestEvent(event.data as { test: boolean; message?: string });
      
      default:
        console.log('[iFood Webhook] Evento não tratado:', event.event);
        return NextResponse.json({ 
          received: true, 
          message: 'Evento recebido mas não processado' 
        });
    }
  } catch (error) {
    console.error('[iFood Webhook] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Handler para novos pedidos
async function handleNewOrder(order: IFoodOrder) {
  try {
    console.log('[iFood Webhook] Novo pedido:', order.orderId);

    // Buscar configuração pelo merchantId
    const empresaId = await findEmpresaByMerchantId(order.merchantId);
    
    if (!empresaId) {
      console.error('[iFood Webhook] MerchantId não encontrado:', order.merchantId);
      return NextResponse.json(
        { error: 'Merchant não encontrado' },
        { status: 404 }
      );
    }

    // Processar o pedido e criar venda
    const vendaId = await processIFoodOrder(empresaId, order);

    console.log('[iFood Webhook] Pedido processado. Venda ID:', vendaId);

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      vendaId,
    });
  } catch (error) {
    console.error('[iFood Webhook] Erro ao processar pedido:', error);
    
    // Registrar erro
    if (order.merchantId) {
      const empresaId = await findEmpresaByMerchantId(order.merchantId);
      if (empresaId) {
        await logIFoodEvent(
          empresaId,
          'order_received',
          `Erro ao processar pedido ${order.orderId}`,
          { order },
          order.orderId,
          undefined,
          false,
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
      }
    }

    return NextResponse.json(
      { error: 'Erro ao processar pedido' },
      { status: 500 }
    );
  }
}

// Handler para atualizações de status
async function handleStatusUpdate(update: IFoodOrderStatusUpdate) {
  try {
    console.log('[iFood Webhook] Atualização de status:', update.orderId, update.status);

    // TODO: Atualizar status da venda no sistema
    // Isso pode ser implementado conforme necessidade

    return NextResponse.json({
      success: true,
      orderId: update.orderId,
      newStatus: update.status,
    });
  } catch (error) {
    console.error('[iFood Webhook] Erro ao atualizar status:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar status' },
      { status: 500 }
    );
  }
}

// Handler para eventos de teste
async function handleTestEvent(data: { test: boolean; message?: string }) {
  console.log('[iFood Webhook] Teste recebido:', data.message || 'Conexão OK');
  
  return NextResponse.json({
    success: true,
    message: 'Webhook funcionando corretamente',
    timestamp: new Date().toISOString(),
  });
}

// Handler para GET (verificação de saúde)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    service: 'iFood Webhook',
    timestamp: new Date().toISOString(),
  });
}

// Função auxiliar para encontrar empresa pelo merchantId
async function findEmpresaByMerchantId(merchantId: string): Promise<string | null> {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  
  const dbInstance = db();
  if (!dbInstance) return null;

  const q = query(
    collection(dbInstance, 'ifood_config'),
    where('merchantId', '==', merchantId),
    where('ativo', '==', true)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const config = snapshot.docs[0].data();
  return config.empresaId;
}

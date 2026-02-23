'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVendas, useProdutos } from '@/hooks/useFirestore';
import {
  BarChart3,
  DollarSign,
  Package,
  Users,
  Loader2,
} from 'lucide-react';

export default function RelatoriosPage() {
  const { vendas, loading: loadingVendas } = useVendas();
  const { produtos, loading: loadingProdutos } = useProdutos();

  const loading = loadingVendas || loadingProdutos;

  // Calcular estatísticas
  const vendasFechadas = vendas.filter(v => v.status === 'fechada');
  const totalVendas = vendasFechadas.reduce((acc, v) => acc + (v.total || 0), 0);
  const ticketMedio = vendasFechadas.length > 0 ? totalVendas / vendasFechadas.length : 0;

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <MainLayout breadcrumbs={[{ title: 'Admin' }, { title: 'Relatórios' }]}>
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <MainLayout
        breadcrumbs={[
          { title: 'Admin' },
          { title: 'Relatórios' },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Relatórios</h1>
              <p className="text-muted-foreground">
                Análises e métricas do seu estabelecimento
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Vendas</p>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                    <p className="text-2xl font-bold">{vendasFechadas.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="text-2xl font-bold">R$ {ticketMedio.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Produtos Ativos</p>
                    <p className="text-2xl font-bold">{produtos.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          {vendas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Sem dados suficientes</p>
                <p className="text-sm text-muted-foreground">Os relatórios serão gerados conforme as vendas forem realizadas</p>
                <Button className="mt-4" asChild>
                  <a href="/pdv">Abrir PDV</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Resumo de Vendas</h3>
                <div className="text-center py-8">
                  <p className="text-4xl font-bold text-green-600 mb-2">
                    R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-muted-foreground">
                    Total acumulado em {vendasFechadas.length} vendas
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

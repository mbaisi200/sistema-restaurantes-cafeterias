'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProdutos } from '@/hooks/useFirestore';
import {
  Package,
  AlertTriangle,
  Warehouse,
  Plus,
  Loader2,
} from 'lucide-react';

export default function EstoquePage() {
  const { produtos, loading } = useProdutos();

  const produtosBaixoEstoque = produtos.filter(p => (p.estoqueAtual || 0) <= (p.estoqueMinimo || 0));

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <MainLayout breadcrumbs={[{ title: 'Admin' }, { title: 'Estoque' }]}>
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
          { title: 'Estoque' },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Controle de Estoque</h1>
              <p className="text-muted-foreground">
                Gerencie o estoque do seu estabelecimento
              </p>
            </div>
          </div>

          {/* Alerts */}
          {produtosBaixoEstoque.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-800">
                      Atenção: {produtosBaixoEstoque.length} produtos com estoque baixo
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Alguns produtos estão abaixo do estoque mínimo. Faça a reposição.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products List */}
          {produtos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Warehouse className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhum produto cadastrado</p>
                <p className="text-sm text-muted-foreground">Cadastre produtos para gerenciar o estoque</p>
                <Button className="mt-4" asChild>
                  <a href="/admin/produtos">
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Produtos
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {produtos.map((produto) => (
                <Card key={produto.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{produto.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            Código: {produto.codigo || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          Estoque: {produto.estoqueAtual || 0} {produto.unidade || 'un'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Mínimo: {produto.estoqueMinimo || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

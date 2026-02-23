'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEmpresas } from '@/hooks/useFirestore';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Eye,
  Ban,
  CheckCircle,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { maskCNPJ, maskPhone, unmask } from '@/lib/masks';

export default function ClientesPage() {
  const { empresas, loading, adicionarEmpresa, atualizarEmpresa } = useEmpresas();
  const [search, setSearch] = useState('');
  const [planoFilter, setPlanoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Estados controlados para máscaras
  const [cnpjValue, setCnpjValue] = useState('');
  const [telefoneValue, setTelefoneValue] = useState('');

  const filteredClientes = empresas.filter(cliente => {
    const matchSearch = cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
                       (cliente.cnpj && cliente.cnpj.includes(search));
    const matchPlano = planoFilter === 'all' || cliente.plano === planoFilter;
    const matchStatus = statusFilter === 'all' || cliente.status === statusFilter;
    return matchSearch && matchPlano && matchStatus;
  });

  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      // 1. Criar a empresa
      const empresaId = await adicionarEmpresa({
        nome: formData.get('nome') as string,
        cnpj: unmask(cnpjValue), // Salva sem máscara
        email: formData.get('email') as string,
        telefone: unmask(telefoneValue), // Salva sem máscara
        cidade: formData.get('cidade') as string,
        estado: formData.get('estado') as string,
        plano: formData.get('plano') as string,
      });

      // 2. Criar o usuário admin no Firebase Auth
      const adminNome = formData.get('admin_nome') as string;
      const adminEmail = formData.get('admin_email') as string;
      const adminSenha = formData.get('admin_senha') as string;

      const authInstance = auth();
      if (!authInstance) throw new Error('Firebase não inicializado');

      const userCredential = await createUserWithEmailAndPassword(
        authInstance,
        adminEmail,
        adminSenha
      );

      // 3. Criar o documento do usuário no Firestore
      const dbInstance = db();
      if (!dbInstance) throw new Error('Firebase não inicializado');

      await setDoc(doc(dbInstance, 'usuarios', userCredential.user.uid), {
        email: adminEmail,
        nome: adminNome,
        role: 'admin',
        empresaId: empresaId,
        ativo: true,
        criadoEm: Timestamp.now(),
        atualizadoEm: Timestamp.now(),
      });

      toast({
        title: 'Cliente cadastrado com sucesso!',
        description: `Empresa e usuário admin criados. O admin pode logar com o email ${adminEmail}`,
      });

      // Fechar diálogo e limpar campos
      setDialogOpen(false);
      setCnpjValue('');
      setTelefoneValue('');
      
      // Não há redirect - usuário permanece no painel de clientes
    } catch (error: unknown) {
      console.error('Erro ao salvar cliente:', error);
      let mensagem = 'Erro ao cadastrar cliente';
      if (error instanceof Error) {
        if (error.message.includes('email-already-in-use')) {
          mensagem = 'Este email já está cadastrado no sistema';
        } else {
          mensagem = error.message;
        }
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: mensagem,
      });
    } finally {
      setSaving(false);
    }
  };

  const planoCores: Record<string, string> = {
    basico: 'bg-gray-500',
    profissional: 'bg-blue-500',
    premium: 'bg-amber-500',
  };

  const statusCores: Record<string, string> = {
    ativo: 'bg-green-500',
    inativo: 'bg-yellow-500',
    bloqueado: 'bg-red-500',
  };

  // Função para formatar CNPJ para exibição
  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '-';
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return cnpj;
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  // Função para formatar telefone para exibição
  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (numbers.length === 10) {
      return numbers.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    return phone;
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['master']}>
        <MainLayout breadcrumbs={[{ title: 'Master' }, { title: 'Clientes' }]}>
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['master']}>
      <MainLayout
        breadcrumbs={[
          { title: 'Master' },
          { title: 'Clientes' },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
              <p className="text-muted-foreground">
                Gerencie todas as empresas cadastradas no sistema
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setCnpjValue('');
                setTelefoneValue('');
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da empresa e do administrador
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSalvar}>
                  <div className="space-y-6 py-4">
                    {/* Dados da Empresa */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        📋 Dados da Empresa
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nome">Nome da Empresa *</Label>
                          <Input id="nome" name="nome" placeholder="Ex: Café Central" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnpj">CNPJ</Label>
                          <Input 
                            id="cnpj" 
                            name="cnpj" 
                            placeholder="00.000.000/0000-00"
                            value={cnpjValue}
                            onChange={(e) => setCnpjValue(maskCNPJ(e.target.value))}
                            maxLength={18}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email da Empresa *</Label>
                          <Input id="email" name="email" type="email" placeholder="contato@empresa.com" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telefone">Telefone</Label>
                          <Input 
                            id="telefone" 
                            name="telefone" 
                            placeholder="(00) 00000-0000"
                            value={telefoneValue}
                            onChange={(e) => setTelefoneValue(maskPhone(e.target.value))}
                            maxLength={15}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cidade">Cidade</Label>
                          <Input id="cidade" name="cidade" placeholder="São Paulo" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="estado">Estado</Label>
                          <Select name="estado">
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SP">São Paulo</SelectItem>
                              <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                              <SelectItem value="MG">Minas Gerais</SelectItem>
                              <SelectItem value="PR">Paraná</SelectItem>
                              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="plano">Plano *</Label>
                          <Select name="plano" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basico">Básico</SelectItem>
                              <SelectItem value="profissional">Profissional</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Dados do Administrador */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Dados do Administrador
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Este usuário terá acesso completo ao painel administrativo da empresa.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin_nome">Nome do Administrador *</Label>
                          <Input id="admin_nome" name="admin_nome" placeholder="Ex: João Silva" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin_email">Email do Administrador *</Label>
                          <Input id="admin_email" name="admin_email" type="email" placeholder="admin@empresa.com" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin_senha">Senha *</Label>
                          <Input id="admin_senha" name="admin_senha" type="password" placeholder="Mínimo 6 caracteres" required minLength={6} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin_senha_conf">Confirmar Senha *</Label>
                          <Input id="admin_senha_conf" name="admin_senha_conf" type="password" placeholder="Repita a senha" required minLength={6} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => {
                      setDialogOpen(false);
                      setCnpjValue('');
                      setTelefoneValue('');
                    }}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Cadastrar Cliente
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CNPJ..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={planoFilter} onValueChange={setPlanoFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Planos</SelectItem>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {filteredClientes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Search className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                <p className="text-sm text-muted-foreground">Clique em "Novo Cliente" para adicionar</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Clientes ({filteredClientes.length})</CardTitle>
                <CardDescription>
                  Lista de todas as empresas cadastradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-semibold">
                                {cliente.nome.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                <p className="text-sm text-muted-foreground">{cliente.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCNPJ(cliente.cnpj)}</TableCell>
                          <TableCell>{cliente.cidade || '-'}/{cliente.estado || '-'}</TableCell>
                          <TableCell>
                            <Badge className={planoCores[cliente.plano] || 'bg-gray-500'}>
                              {cliente.plano?.charAt(0).toUpperCase() + cliente.plano?.slice(1) || 'Sem plano'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusCores[cliente.status] || 'bg-gray-500'}>
                              {cliente.status?.charAt(0).toUpperCase() + cliente.status?.slice(1) || 'Indefinido'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {cliente.status === 'ativo' ? (
                                  <DropdownMenuItem 
                                    className="text-yellow-600"
                                    onClick={() => atualizarEmpresa(cliente.id, { status: 'bloqueado' })}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Bloquear
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem 
                                    className="text-green-600"
                                    onClick={() => atualizarEmpresa(cliente.id, { status: 'ativo' })}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Ativar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

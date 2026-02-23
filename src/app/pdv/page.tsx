'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useProdutos, useCategorias, useMesas, useCaixa, registrarLog } from '@/hooks/useFirestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Coffee,
  LogOut,
  UtensilsCrossed,
  Package,
  User,
  Loader2,
  Truck,
  Printer,
  CheckCircle,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ItemPedido {
  id: string;
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  atendenteId: string;
  atendenteNome: string;
  tipoVenda: 'balcao' | 'mesa' | 'delivery';
  mesaNumero?: number;
  cliente?: string;
  criadoEm: Date;
}

interface DeliveryInfo {
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  cep: string;
  observacao: string;
}

type TipoVenda = 'balcao' | 'mesa' | 'delivery';

export default function PDVPage() {
  const { user, empresaId, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { produtos, loading: loadingProdutos } = useProdutos();
  const { categorias, loading: loadingCategorias } = useCategorias();
  const { mesas, loading: loadingMesas, atualizarMesa } = useMesas();
  const { caixaAberto, registrarVenda, abrirCaixa,fecharCaixa } = useCaixa();
  
  // Estados
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [tipoVenda, setTipoVenda] = useState<TipoVenda>('balcao');
  const [mesaSelecionada, setMesaSelecionada] = useState<string>('');
  const [numeroMesaSelecionada, setNumeroMesaSelecionada] = useState<number>(0);
  const [deliverySelecionado, setDeliverySelecionado] = useState<string>('');
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', cep: '', observacao: '',
  });
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [dialogPagamento, setDialogPagamento] = useState(false);
  const [dialogDelivery, setDialogDelivery] = useState(false);
  const [processando, setProcessando] = useState(false);

  const loading = loadingProdutos || loadingCategorias || loadingMesas;

  // Carregar pedidos da mesa selecionada
  useEffect(() => {
    if (tipoVenda !== 'mesa' || !mesaSelecionada || !empresaId) {
      setItensPedido([]);
      return;
    }

    const dbInstance = db();
    if (!dbInstance) return;

    const q = query(
      collection(dbInstance, 'pedidos_temp'),
      where('empresaId', '==', empresaId),
      where('mesaId', '==', mesaSelecionada)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        criadoEm: doc.data().criadoEm?.toDate(),
      })) as ItemPedido[];
      
      itens.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
      setItensPedido(itens);
    }, (error) => {
      console.error('Erro ao carregar pedidos:', error);
    });

    return () => unsubscribe();
  }, [tipoVenda, mesaSelecionada, empresaId]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    let lista = produtos || [];
    if (categoriaAtiva !== 'todos') {
      lista = lista.filter(p => p.categoriaId === categoriaAtiva);
    }
    if (search) {
      lista = lista.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));
    }
    return lista;
  }, [produtos, categoriaAtiva, search]);

  // Mesas organizadas por status
  const mesasOrdenadas = useMemo(() => {
    return (mesas || []).sort((a, b) => a.numero - b.numero);
  }, [mesas]);

  // Total do pedido
  const total = (itensPedido || []).reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

  // Função auxiliar para obter cor da categoria
  const getCorCategoria = (categoriaId: string) => {
    const categoria = categorias?.find(c => c.id === categoriaId);
    return categoria?.cor || '#3B82F6';
  };

  // Função auxiliar para obter label do tipo de venda
  const getTipoVendaLabel = () => {
    switch (tipoVenda) {
      case 'mesa': return `Mesa ${numeroMesaSelecionada}`;
      case 'delivery': return 'Delivery';
      default: return 'Balcão';
    }
  };

  // Adicionar produto
  const adicionarProduto = async (produto: typeof produtos[0]) => {
    if (!produto.preco || produto.preco <= 0) {
      toast({ variant: 'destructive', title: 'Produto sem preço definido' });
      return;
    }

    if (tipoVenda === 'mesa' && !mesaSelecionada) {
      toast({ variant: 'destructive', title: 'Selecione uma mesa primeiro' });
      return;
    }

    if (tipoVenda === 'delivery' && !deliverySelecionado) {
      toast({ variant: 'destructive', title: 'Inicie um delivery primeiro' });
      setDialogDelivery(true);
      return;
    }

    const dbInstance = db();
    if (!dbInstance) return;

    // Para mesa e delivery, salva no Firestore
    if (tipoVenda === 'mesa' || tipoVenda === 'delivery') {
      try {
        await addDoc(collection(dbInstance, 'pedidos_temp'), {
          empresaId,
          mesaId: mesaSelecionada || null,
          mesaNumero: numeroMesaSelecionada || null,
          deliveryId: deliverySelecionado || null,
          deliveryInfo: tipoVenda === 'delivery' ? deliveryInfo : null,
          produtoId: produto.id,
          nome: produto.nome,
          preco: produto.preco,
          quantidade: 1,
          atendenteId: user?.id,
          atendenteNome: user?.nome,
          tipoVenda,
          criadoEm: Timestamp.now(),
        });
        
        // Se a mesa estava livre, marcar como ocupada
        if (tipoVenda === 'mesa' && mesaSelecionada) {
          const mesaAtual = mesas.find(m => m.id === mesaSelecionada);
          if (mesaAtual && mesaAtual.status === 'livre') {
            await atualizarMesa(mesaSelecionada, { status: 'ocupada' });
          }
        }
      } catch (error) {
        console.error('Erro ao salvar produto:', error);
        toast({ variant: 'destructive', title: 'Erro ao adicionar produto' });
        return;
      }
    } else {
      // Para balcão, mantém local
      const existente = itensPedido.find(item => item.produtoId === produto.id);
      
      if (existente) {
        setItensPedido(itensPedido.map(item => 
          item.id === existente.id 
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        ));
      } else {
        setItensPedido([...itensPedido, {
          id: Date.now().toString(),
          produtoId: produto.id,
          nome: produto.nome,
          preco: produto.preco,
          quantidade: 1,
          atendenteId: user?.id || '',
          atendenteNome: user?.nome || '',
          tipoVenda: 'balcao',
          criadoEm: new Date(),
        }]);
      }
    }

    toast({ title: `✓ ${produto.nome} adicionado` });
  };

  // Alterar quantidade
  const alterarQtd = async (itemId: string, delta: number, quantidadeAtual: number) => {
    const dbInstance = db();
    if (!dbInstance) return;

    const novaQtd = quantidadeAtual + delta;
    
    if (tipoVenda === 'mesa' || tipoVenda === 'delivery') {
      if (novaQtd <= 0) {
        await deleteDoc(doc(dbInstance, 'pedidos_temp', itemId));
      } else {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(dbInstance, 'pedidos_temp', itemId), { quantidade: novaQtd });
      }
    } else {
      if (novaQtd <= 0) {
        setItensPedido(itensPedido.filter(item => item.id !== itemId));
      } else {
        setItensPedido(itensPedido.map(item => 
          item.id === itemId ? { ...item, quantidade: novaQtd } : item
        ));
      }
    }
  };

  // Remover item
  const removerItem = async (itemId: string) => {
    const dbInstance = db();
    if (!dbInstance) return;

    if (tipoVenda === 'mesa' || tipoVenda === 'delivery') {
      await deleteDoc(doc(dbInstance, 'pedidos_temp', itemId));
    } else {
      setItensPedido(itensPedido.filter(item => item.id !== itemId));
    }
  };

  // Limpar pedido
  const limparPedido = async () => {
    if ((tipoVenda === 'mesa' || tipoVenda === 'delivery') && mesaSelecionada) {
      const dbInstance = db();
      if (dbInstance) {
        const deletePromises = itensPedido.map(item => 
          deleteDoc(doc(dbInstance, 'pedidos_temp', item.id))
        );
        await Promise.all(deletePromises);
      }
    } else {
      setItensPedido([]);
    }
    if (tipoVenda === 'delivery') {
      setDeliverySelecionado('');
      setDeliveryInfo({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', cep: '', observacao: '' });
    }
  };

  // Selecionar mesa
  const selecionarMesa = async (mesaId: string, numero: number, status: string) => {
    setMesaSelecionada(mesaId);
    setNumeroMesaSelecionada(numero);
    setTipoVenda('mesa');
    setDeliverySelecionado('');
  };

  // Iniciar delivery
  const iniciarDelivery = () => {
    if (!deliveryInfo.nome) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente' });
      return;
    }
    const deliveryId = 'DEL_' + Date.now();
    setDeliverySelecionado(deliveryId);
    setTipoVenda('delivery');
    setDialogDelivery(false);
    toast({ title: `Delivery iniciado para: ${deliveryInfo.nome}` });
  };

  // Trocar tipo de venda
  const trocarTipoVenda = (novoTipo: TipoVenda) => {
    if (novoTipo === 'mesa') {
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
      setItensPedido([]);
    } else if (novoTipo === 'balcao') {
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
      setDeliverySelecionado('');
      setDeliveryInfo({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', cep: '', observacao: '' });
    } else if (novoTipo === 'delivery') {
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
      setItensPedido([]);
      setDialogDelivery(true);
    }
    setTipoVenda(novoTipo);
  };

  // Finalizar venda
  const finalizarVenda = async (formaPagamento: string) => {
    if (itensPedido.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione itens ao pedido' });
      return;
    }

    setProcessando(true);
    try {
      await registrarVenda(itensPedido, total, formaPagamento, tipoVenda, mesaSelecionada);
      
      // Log da venda finalizada
      await registrarLog({
        empresaId: empresaId || '',
        usuarioId: user?.id || '',
        usuarioNome: user?.nome || '',
        acao: 'VENDA_FINALIZADA',
        detalhes: `Venda de ${itensPedido.length} itens - R$ ${total.toFixed(2)}`,
        tipo: 'venda',
      });

      toast({ title: '✓ Venda finalizada com sucesso!' });
      setDialogPagamento(false);
      setItensPedido([]);
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast({ variant: 'destructive', title: 'Erro ao finalizar venda' });
    } finally {
      setProcessando(false);
    }
  };

  // Imprimir comanda
  const imprimirComanda = () => {
    const conteudo = `
      COMANDA - ${getTipoVendaLabel()}
      ${new Date().toLocaleString('pt-BR')}
      
      ${itensPedido.map((item, i) => `${i + 1}. ${item.nome} x${item.quantidade}`).join('\n')}
      
      TOTAL: R$ ${total.toFixed(2)}
    `;
    window.print();
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'funcionario']}>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-orange-50 to-amber-50">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'funcionario']}>
      <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        
        {/* HEADER VIBRANTE */}
        <header className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-orange-600 font-bold shadow-md">
              {user?.nome?.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-white text-lg">{user?.nome}</p>
              <p className="text-xs text-orange-100">Ponto de Venda</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${caixaAberto ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'} shadow-md`}>
              <CheckCircle className="h-4 w-4" />
              {caixaAberto ? 'Caixa Aberto' : 'Caixa Fechado'}
            </div>

            {!caixaAberto ? (
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white font-bold shadow-md"
                onClick={() => abrirCaixa(0)}
              >
                Abrir Caixa
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white font-bold shadow-md"
                onClick={() => fecharCaixa(caixaAberto.valorAtual || 0)}
              >
                Fechar Caixa
              </Button>
            )}

            <Badge className="bg-white text-orange-600 px-4 py-2 text-sm font-bold shadow-md">
              {getTipoVendaLabel()}
            </Badge>

            <Button 
              variant="destructive" 
              onClick={handleLogout} 
              className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow-md"
            >
              <LogOut className="h-4 w-4" />
              SAIR
            </Button>
          </div>
        </header>

        {/* SELEÇÃO DE TIPO DE VENDA */}
        <div className="bg-white border-b-2 border-orange-200 px-6 py-3 flex gap-3 items-center shadow-sm">
          <span className="text-sm font-bold text-gray-700 uppercase">Tipo de Venda:</span>
          <Button
            variant={tipoVenda === 'balcao' ? 'default' : 'outline'}
            size="sm"
            className={`font-bold transition-all ${tipoVenda === 'balcao' ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md' : 'border-2 border-blue-400 text-blue-600 hover:bg-blue-50'}`}
            onClick={() => trocarTipoVenda('balcao')}
          >
            <Package className="h-4 w-4 mr-2" />
            Balcão
          </Button>
          <Button
            variant={tipoVenda === 'mesa' ? 'default' : 'outline'}
            size="sm"
            className={`font-bold transition-all ${tipoVenda === 'mesa' ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md' : 'border-2 border-purple-400 text-purple-600 hover:bg-purple-50'}`}
            onClick={() => trocarTipoVenda('mesa')}
          >
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Mesa
          </Button>
          <Button
            variant={tipoVenda === 'delivery' ? 'default' : 'outline'}
            size="sm"
            className={`font-bold transition-all ${tipoVenda === 'delivery' ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md' : 'border-2 border-green-400 text-green-600 hover:bg-green-50'}`}
            onClick={() => trocarTipoVenda('delivery')}
          >
            <Truck className="h-4 w-4 mr-2" />
            Delivery
          </Button>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden gap-4 p-4">
          
          {/* COLUNA ESQUERDA - MESAS (se selecionado) */}
          {tipoVenda === 'mesa' && (
            <div className="w-48 bg-white rounded-xl shadow-lg border-2 border-purple-200 flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 text-white font-bold">
                MESAS
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {mesasOrdenadas.map(mesa => (
                    <button
                      key={mesa.id}
                      onClick={() => selecionarMesa(mesa.id, mesa.numero, mesa.status)}
                      className={`w-full p-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                        mesaSelecionada === mesa.id
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                          : mesa.status === 'livre'
                          ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 hover:shadow-md'
                          : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">Mesa {mesa.numero}</span>
                        <Badge className={`text-xs font-bold ${mesa.status === 'livre' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                          {mesa.status === 'livre' ? 'Livre' : 'Ocupada'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* COLUNA CENTRAL - PRODUTOS */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-xl shadow-lg border-2 border-orange-200">
            
            {/* CATEGORIAS */}
            <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-3 flex gap-2 overflow-x-auto border-b-2 border-orange-200">
              <Button
                size="sm"
                variant={categoriaAtiva === 'todos' ? 'default' : 'outline'}
                className={`font-bold whitespace-nowrap transition-all ${categoriaAtiva === 'todos' ? 'bg-white text-orange-600 shadow-md' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                onClick={() => setCategoriaAtiva('todos')}
              >
                Todos
              </Button>
              {(categorias || []).map(cat => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={categoriaAtiva === cat.id ? 'default' : 'outline'}
                  style={categoriaAtiva === cat.id ? { backgroundColor: cat.cor, color: 'white' } : { borderColor: cat.cor, color: cat.cor }}
                  className={`font-bold whitespace-nowrap transition-all ${categoriaAtiva === cat.id ? 'shadow-md' : 'bg-white hover:shadow-md'}`}
                  onClick={() => setCategoriaAtiva(cat.id)}
                >
                  {cat.nome}
                </Button>
              ))}
            </div>

            {/* BUSCA */}
            <div className="p-4 border-b-2 border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-400" />
                <Input
                  placeholder="🔍 Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg font-semibold"
                />
              </div>
            </div>

            {/* GRID PRODUTOS */}
            <ScrollArea className="flex-1 p-4">
              {produtosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Package className="h-20 w-20 mb-4 opacity-30" />
                  <p className="text-lg font-bold">Nenhum produto cadastrado</p>
                  <p className="text-sm">O admin precisa cadastrar produtos primeiro</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {(produtosFiltrados || []).map(produto => {
                    const corCategoria = getCorCategoria(produto.categoriaId);
                    return (
                      <button
                        key={produto.id}
                        className="group bg-white rounded-xl p-3 hover:shadow-xl active:scale-95 transition-all border-2 border-orange-100 hover:border-orange-300 overflow-hidden relative"
                        onClick={() => adicionarProduto(produto)}
                      >
                        {/* Fundo gradiente no hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative z-10">
                          <div 
                            className="h-14 rounded-lg flex items-center justify-center mb-2 shadow-md transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${corCategoria}25` }}
                          >
                            <Coffee className="h-7 w-7 transition-transform group-hover:rotate-12" style={{ color: corCategoria }} />
                          </div>
                          <p className="text-sm font-bold truncate text-gray-800 group-hover:text-orange-600">{produto.nome}</p>
                          <p className="text-base font-extrabold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent mt-1">
                            R$ {(produto.preco || 0).toFixed(2)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* COLUNA DIREITA - CARRINHO */}
          <div className="w-96 bg-white rounded-xl shadow-lg border-2 border-green-200 flex flex-col overflow-hidden">
            
            {/* HEADER CARRINHO */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6" />
                  PEDIDO
                </h2>
                {itensPedido.length > 0 && (
                  <Badge className="bg-white text-green-600 font-bold text-lg px-3 py-1">
                    {itensPedido.length}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-green-100 font-semibold">
                {getTipoVendaLabel()}
              </p>
              
              {tipoVenda === 'delivery' && itensPedido.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={imprimirComanda}
                  className="w-full mt-3 border-white text-white hover:bg-white hover:text-green-600 font-bold"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Comanda
                </Button>
              )}
            </div>

            {/* ITENS DO CARRINHO */}
            <ScrollArea className="flex-1 p-4">
              {itensPedido.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ShoppingCart className="h-16 w-16 mb-3 opacity-20" />
                  <p className="font-bold text-gray-600">Carrinho vazio</p>
                  <p className="text-xs text-gray-500 mt-1">Clique nos produtos para lançar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(itensPedido || []).map((item, index) => (
                    <div key={item.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-200 hover:border-green-400 transition-all shadow-sm hover:shadow-md">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-green-500 text-white px-2 py-1 rounded-full">#{index + 1}</span>
                            <p className="font-bold text-gray-800">{item.nome}</p>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            {item.atendenteNome}
                          </p>
                        </div>
                        <button
                          className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1 rounded transition-all"
                          onClick={() => removerItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-bold transition-all shadow-md"
                            onClick={() => alterarQtd(item.id, -1, item.quantidade)}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-lg text-gray-800">{item.quantidade}</span>
                          <button
                            className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center font-bold transition-all shadow-md"
                            onClick={() => alterarQtd(item.id, 1, item.quantidade)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                          R$ {(item.preco * item.quantidade).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* TOTAL E FINALIZAR */}
            <div className="p-4 border-t-2 border-green-200 space-y-3 bg-gradient-to-b from-white to-green-50">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-700">TOTAL:</span>
                <span className="text-3xl font-extrabold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                  R$ {total.toFixed(2)}
                </span>
              </div>
              
              <Button
                className="w-full h-16 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={itensPedido.length === 0 || processando}
                onClick={() => setDialogPagamento(true)}
              >
                <CreditCard className="h-6 w-6 mr-2" />
                {processando ? 'Processando...' : 'FINALIZAR VENDA'}
              </Button>

              {itensPedido.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full border-2 border-red-400 text-red-600 hover:bg-red-50 font-bold"
                  onClick={limparPedido}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Carrinho
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DIALOG DELIVERY */}
      <Dialog open={dialogDelivery} onOpenChange={setDialogDelivery}>
        <DialogContent className="max-w-lg border-2 border-green-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Truck className="h-6 w-6" />
              Novo Delivery
            </DialogTitle>
            <DialogDescription className="text-gray-600">Preencha os dados do cliente</DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Nome *</Label>
                <Input 
                  value={deliveryInfo.nome} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, nome: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">Telefone *</Label>
                <Input 
                  value={deliveryInfo.telefone} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, telefone: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="font-bold">Endereço *</Label>
                <Input 
                  value={deliveryInfo.endereco} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, endereco: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">Número *</Label>
                <Input 
                  value={deliveryInfo.numero} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, numero: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Complemento</Label>
                <Input 
                  value={deliveryInfo.complemento} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, complemento: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">Bairro *</Label>
                <Input 
                  value={deliveryInfo.bairro} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, bairro: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Cidade *</Label>
                <Input 
                  value={deliveryInfo.cidade} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, cidade: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">CEP</Label>
                <Input 
                  value={deliveryInfo.cep} 
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, cep: e.target.value})}
                  className="border-2 border-green-200 focus:border-green-500 rounded-lg"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="font-bold">Observação</Label>
              <Textarea 
                value={deliveryInfo.observacao} 
                onChange={(e) => setDeliveryInfo({...deliveryInfo, observacao: e.target.value})}
                rows={2}
                className="border-2 border-green-200 focus:border-green-500 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogDelivery(false)} 
              className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-bold"
            >
              Cancelar
            </Button>
            <Button 
              onClick={iniciarDelivery} 
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg"
            >
              <Truck className="h-4 w-4 mr-2" />
              Iniciar Delivery
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG PAGAMENTO */}
      <Dialog open={dialogPagamento} onOpenChange={setDialogPagamento}>
        <DialogContent className="max-w-md border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Forma de Pagamento
            </DialogTitle>
            <DialogDescription className="text-center font-semibold text-gray-700">{getTipoVendaLabel()}</DialogDescription>
          </DialogHeader>
          
          <div className="text-center py-6 bg-white rounded-xl border-2 border-orange-200 shadow-md">
            <p className="text-5xl font-extrabold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">R$ {total.toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-2 font-semibold">{itensPedido.length} itens</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="h-24 text-lg font-bold bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg transition-all transform hover:scale-105" 
              onClick={() => finalizarVenda('dinheiro')} 
              disabled={processando}
            >
              <Banknote className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span>DINHEIRO</span>
              </div>
            </Button>
            <Button 
              className="h-24 text-lg font-bold bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg transition-all transform hover:scale-105" 
              onClick={() => finalizarVenda('credito')} 
              disabled={processando}
            >
              <CreditCard className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span>CRÉDITO</span>
              </div>
            </Button>
            <Button 
              className="h-24 text-lg font-bold bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg transition-all transform hover:scale-105" 
              onClick={() => finalizarVenda('debito')} 
              disabled={processando}
            >
              <CreditCard className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span>DÉBITO</span>
              </div>
            </Button>
            <Button 
              className="h-24 text-lg font-bold bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-lg transition-all transform hover:scale-105" 
              onClick={() => finalizarVenda('pix')} 
              disabled={processando}
            >
              <Smartphone className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span>PIX</span>
              </div>
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setDialogPagamento(false)} 
            className="w-full border-2 border-gray-300 hover:bg-gray-100 font-bold text-gray-700"
          >
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>

    </ProtectedRoute>
  );
}

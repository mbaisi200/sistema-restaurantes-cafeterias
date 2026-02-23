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
    // Só seleciona a mesa, NÃO marca como ocupada
    // A mesa só será marcada como ocupada quando adicionar um produto
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
      setTipoVenda('mesa');
      setDeliverySelecionado('');
    } else if (novoTipo === 'delivery') {
      setDialogDelivery(true);
    } else {
      setTipoVenda('balcao');
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
      setDeliverySelecionado('');
      setItensPedido([]);
    }
  };

  // Finalizar venda
  const finalizarVenda = async (formaPagamento: string) => {
    if (itensPedido.length === 0) return;
    
    // Verificar se há caixa aberto
    if (!caixaAberto) {
      toast({ variant: 'destructive', title: '⚠️ Abra o caixa primeiro!', description: 'Vá em Caixa e abra o caixa para realizar vendas.' });
      return;
    }
    
    setProcessando(true);
    try {
      const dbInstance = db();
      if (!dbInstance) throw new Error('Erro');

      const vendaRef = await addDoc(collection(dbInstance, 'vendas'), {
        empresaId,
        itens: itensPedido.map(item => ({
          produtoId: item.produtoId,
          nome: item.nome,
          preco: item.preco,
          quantidade: item.quantidade,
          atendenteId: item.atendenteId,
          atendenteNome: item.atendenteNome,
        })),
        total,
        formaPagamento,
        tipoVenda,
        mesaId: mesaSelecionada || null,
        mesaNumero: numeroMesaSelecionada || null,
        deliveryInfo: tipoVenda === 'delivery' ? deliveryInfo : null,
        funcionarioId: user?.id,
        funcionarioNome: user?.nome,
        status: 'concluida',
        caixaId: caixaAberto.id,
        criadoEm: Timestamp.now(),
      });

      // Registrar venda no caixa
      await registrarVenda(total, formaPagamento, vendaRef.id);

      // Limpar pedidos temporários
      if (tipoVenda === 'mesa' || tipoVenda === 'delivery') {
        const dbInst = db();
        if (dbInst) {
          const deletePromises = itensPedido.map(item => 
            deleteDoc(doc(dbInst, 'pedidos_temp', item.id))
          );
          await Promise.all(deletePromises);
          
          // Liberar a mesa
          if (tipoVenda === 'mesa' && mesaSelecionada) {
            await atualizarMesa(mesaSelecionada, { status: 'livre' });
          }
        }
      }

      // Reset
      setItensPedido([]);
      setMesaSelecionada('');
      setNumeroMesaSelecionada(0);
      setDeliverySelecionado('');
      setDeliveryInfo({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', cep: '', observacao: '' });
      setTipoVenda('balcao');
      setDialogPagamento(false);
      
      toast({ title: '✅ Venda finalizada!', description: `R$ ${total.toFixed(2)}` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao finalizar venda' });
    } finally {
      setProcessando(false);
    }
  };

  // Imprimir comanda
  const imprimirComanda = () => {
    const texto = `
====================================
           COMANDA DE DELIVERY
====================================
CLIENTE: ${deliveryInfo.nome}
TELEFONE: ${deliveryInfo.telefone}
------------------------------------
ENDEREÇO:
${deliveryInfo.endereco}, ${deliveryInfo.numero}
${deliveryInfo.complemento ? deliveryInfo.complemento + '\n' : ''}${deliveryInfo.bairro}
${deliveryInfo.cidade} - CEP: ${deliveryInfo.cep}
------------------------------------
OBSERVAÇÕES:
${deliveryInfo.observacao || 'Nenhuma'}
====================================
ITENS:
${(itensPedido || []).map(item => `${item.quantidade}x ${item.nome} - R$ ${(item.preco * item.quantidade).toFixed(2)}`).join('\n')}
------------------------------------
TOTAL: R$ ${total.toFixed(2)}
====================================
Atendente: ${user?.nome}
Data: ${new Date().toLocaleString('pt-BR')}
====================================
    `.trim();

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${texto}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    localStorage.clear();
    sessionStorage.clear();
    router.push('/');
  };

  // Cor da categoria
  const getCorCategoria = (categoriaId: string) => {
    const cat = (categorias || []).find(c => c.id === categoriaId);
    return cat?.cor || '#3b82f6';
  };

  // Label do tipo de venda
  const getTipoVendaLabel = () => {
    switch (tipoVenda) {
      case 'mesa': return `MESA ${numeroMesaSelecionada}`;
      case 'delivery': return `DELIVERY - ${deliveryInfo.nome}`;
      default: return 'BALCÃO';
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'funcionario']}>
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'funcionario']}>
      <div className="h-screen flex bg-gray-100">
        
        {/* COLUNA ESQUERDA - MESAS CADASTRADAS */}
        <div className="w-56 bg-white border-r flex flex-col shrink-0">
          <div className="p-3 border-b bg-blue-600 text-white">
            <h2 className="font-bold text-sm">MESAS</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {mesasOrdenadas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  Nenhuma mesa cadastrada.
                  <br />
                  <span className="text-xs">O admin deve cadastrar mesas.</span>
                </p>
              ) : (
                mesasOrdenadas.map(mesa => (
                  <button
                    key={mesa.id}
                    onClick={() => selecionarMesa(mesa.id, mesa.numero, mesa.status)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      mesaSelecionada === mesa.id 
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300' 
                        : mesa.status === 'livre'
                          ? 'bg-green-50 hover:bg-green-100 text-gray-800 border border-green-200'
                          : 'bg-red-50 hover:bg-red-100 text-gray-800 border border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">Mesa {mesa.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        mesa.status === 'livre' 
                          ? mesaSelecionada === mesa.id ? 'bg-white/20 text-white' : 'bg-green-200 text-green-800'
                          : mesaSelecionada === mesa.id ? 'bg-white/20 text-white' : 'bg-red-200 text-red-800'
                      }`}>
                        {mesa.status === 'livre' ? 'Livre' : 'Ocupada'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* HEADER */}
          <header className="bg-white px-4 py-2 flex items-center justify-between shrink-0 border-b shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {user?.nome?.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{user?.nome}</p>
                <p className="text-xs text-gray-500">Operador de Caixa</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
                <CheckCircle className="h-4 w-4" />
                Online
              </div>

              {caixaAberto ? (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Caixa Aberto
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-100 text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Caixa Fechado
                </div>
              )}

              {!caixaAberto ? (
  <Button
    size="sm"
    className="bg-green-600 hover:bg-green-700"
    onClick={() => abrirCaixa(0)}
  >
    Abrir Caixa
  </Button>
) : (
  <Button
    size="sm"
    variant="destructive"
    onClick={() => fecharCaixa(caixaAberto.valorAtual || 0)}
  >
    Fechar Caixa
  </Button>
)}

              <Badge className="bg-blue-600 text-white px-4 py-2 text-sm">
                {getTipoVendaLabel()}
              </Badge>

              <Button variant="destructive" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                SAIR
              </Button>
            </div>
          </header>

          {/* SELEÇÃO DE TIPO DE VENDA */}
          <div className="bg-white border-b px-4 py-2 flex gap-2 items-center">
            <span className="text-sm font-medium text-gray-600">Tipo de Venda:</span>
            <Button
              variant={tipoVenda === 'balcao' ? 'default' : 'outline'}
              size="sm"
              className={tipoVenda === 'balcao' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}
              onClick={() => trocarTipoVenda('balcao')}
            >
              <Package className="h-4 w-4 mr-1" />
              Balcão
            </Button>
            <Button
              variant={tipoVenda === 'mesa' ? 'default' : 'outline'}
              size="sm"
              className={tipoVenda === 'mesa' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}
              onClick={() => trocarTipoVenda('mesa')}
            >
              <UtensilsCrossed className="h-4 w-4 mr-1" />
              Mesa
            </Button>
            <Button
              variant={tipoVenda === 'delivery' ? 'default' : 'outline'}
              size="sm"
              className={tipoVenda === 'delivery' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}
              onClick={() => trocarTipoVenda('delivery')}
            >
              <Truck className="h-4 w-4 mr-1" />
              Delivery
            </Button>
          </div>

          {/* CONTEÚDO */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* COLUNA PRODUTOS */}
            <div className="flex-1 flex flex-col overflow-hidden border-r">
              {/* CATEGORIAS */}
              <div className="bg-white p-2 flex gap-2 overflow-x-auto border-b">
                <Button
                  size="sm"
                  variant={categoriaAtiva === 'todos' ? 'default' : 'outline'}
                  className={categoriaAtiva === 'todos' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-600 text-blue-600'}
                  onClick={() => setCategoriaAtiva('todos')}
                >
                  Todos
                </Button>
                {(categorias || []).map(cat => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={categoriaAtiva === cat.id ? 'default' : 'outline'}
                    style={categoriaAtiva === cat.id ? { backgroundColor: cat.cor } : {}}
                    onClick={() => setCategoriaAtiva(cat.id)}
                  >
                    {cat.nome}
                  </Button>
                ))}
              </div>

              {/* BUSCA */}
              <div className="p-2 border-b bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar produto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* GRID PRODUTOS */}
              <ScrollArea className="flex-1 p-3 bg-gray-100">
                {produtosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Package className="h-16 w-16 mb-4" />
                    <p className="text-lg font-medium">Nenhum produto cadastrado</p>
                    <p className="text-sm">O admin precisa cadastrar produtos primeiro</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {(produtosFiltrados || []).map(produto => (
                      <button
                        key={produto.id}
                        className="bg-white rounded-lg p-3 hover:shadow-lg active:scale-95 transition-all text-left border hover:border-blue-300"
                        onClick={() => adicionarProduto(produto)}
                      >
                        <div 
                          className="h-12 rounded flex items-center justify-center mb-2"
                          style={{ backgroundColor: `${getCorCategoria(produto.categoriaId)}20` }}
                        >
                          <Coffee className="h-6 w-6" style={{ color: getCorCategoria(produto.categoriaId) }} />
                        </div>
                        <p className="text-sm font-medium truncate">{produto.nome}</p>
                        <p className="text-base font-bold text-green-600">
                          R$ {(produto.preco || 0).toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* COLUNA PEDIDOS */}
            <div className="w-96 bg-white flex flex-col border-l">
              
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    PEDIDOS
                  </h2>
                  {itensPedido.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={limparPedido} className="text-red-500">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {itensPedido.length} itens • {getTipoVendaLabel()}
                </p>
                
                {tipoVenda === 'delivery' && itensPedido.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={imprimirComanda}
                    className="w-full mt-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Comanda
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-3">
                {itensPedido.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <ShoppingCart className="h-12 w-12 mb-2" />
                    <p>Nenhum pedido</p>
                    <p className="text-xs">Clique nos produtos para lançar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(itensPedido || []).map((item, index) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-3 border">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 bg-gray-200 px-1 rounded">#{index + 1}</span>
                              <p className="font-medium">{item.nome}</p>
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              {item.atendenteNome}
                            </p>
                          </div>
                          <button
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removerItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                              onClick={() => alterarQtd(item.id, -1, item.quantidade)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-bold">{item.quantidade}</span>
                            <button
                              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                              onClick={() => alterarQtd(item.id, 1, item.quantidade)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="font-bold text-green-600">
                            R$ {(item.preco * item.quantidade).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* TOTAL E FINALIZAR */}
              <div className="p-4 border-t space-y-4">
                <div className="flex justify-between items-center text-2xl font-bold">
                  <span>TOTAL</span>
                  <span className="text-green-600">R$ {total.toFixed(2)}</span>
                </div>
                
                <Button
                  className="w-full h-16 text-xl bg-green-600 hover:bg-green-700"
                  disabled={itensPedido.length === 0}
                  onClick={() => setDialogPagamento(true)}
                >
                  <CreditCard className="h-6 w-6 mr-2" />
                  FINALIZAR VENDA
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DIALOG DELIVERY */}
      <Dialog open={dialogDelivery} onOpenChange={setDialogDelivery}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Novo Delivery
            </DialogTitle>
            <DialogDescription>Preencha os dados do cliente</DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={deliveryInfo.nome} onChange={(e) => setDeliveryInfo({...deliveryInfo, nome: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Telefone *</Label>
                <Input value={deliveryInfo.telefone} onChange={(e) => setDeliveryInfo({...deliveryInfo, telefone: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Endereço *</Label>
                <Input value={deliveryInfo.endereco} onChange={(e) => setDeliveryInfo({...deliveryInfo, endereco: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Número *</Label>
                <Input value={deliveryInfo.numero} onChange={(e) => setDeliveryInfo({...deliveryInfo, numero: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Complemento</Label>
                <Input value={deliveryInfo.complemento} onChange={(e) => setDeliveryInfo({...deliveryInfo, complemento: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Bairro *</Label>
                <Input value={deliveryInfo.bairro} onChange={(e) => setDeliveryInfo({...deliveryInfo, bairro: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade *</Label>
                <Input value={deliveryInfo.cidade} onChange={(e) => setDeliveryInfo({...deliveryInfo, cidade: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>CEP</Label>
                <Input value={deliveryInfo.cep} onChange={(e) => setDeliveryInfo({...deliveryInfo, cep: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea value={deliveryInfo.observacao} onChange={(e) => setDeliveryInfo({...deliveryInfo, observacao: e.target.value})} rows={2} />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogDelivery(false)} className="flex-1">Cancelar</Button>
            <Button onClick={iniciarDelivery} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Truck className="h-4 w-4 mr-2" />
              Iniciar Delivery
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG PAGAMENTO */}
      <Dialog open={dialogPagamento} onOpenChange={setDialogPagamento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Forma de Pagamento</DialogTitle>
            <DialogDescription className="text-center">{getTipoVendaLabel()}</DialogDescription>
          </DialogHeader>
          
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-green-600">R$ {total.toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">{itensPedido.length} itens</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-20 text-lg bg-green-600 hover:bg-green-700" onClick={() => finalizarVenda('dinheiro')} disabled={processando}>
              <Banknote className="h-6 w-6 mr-2" />DINHEIRO
            </Button>
            <Button className="h-20 text-lg bg-blue-600 hover:bg-blue-700" onClick={() => finalizarVenda('credito')} disabled={processando}>
              <CreditCard className="h-6 w-6 mr-2" />CRÉDITO
            </Button>
            <Button className="h-20 text-lg bg-purple-600 hover:bg-purple-700" onClick={() => finalizarVenda('debito')} disabled={processando}>
              <CreditCard className="h-6 w-6 mr-2" />DÉBITO
            </Button>
            <Button className="h-20 text-lg bg-teal-600 hover:bg-teal-700" onClick={() => finalizarVenda('pix')} disabled={processando}>
              <Smartphone className="h-6 w-6 mr-2" />PIX
            </Button>
          </div>
          
          <Button variant="outline" onClick={() => setDialogPagamento(false)} className="w-full mt-4">Cancelar</Button>
        </DialogContent>
      </Dialog>

    </ProtectedRoute>
  );
}

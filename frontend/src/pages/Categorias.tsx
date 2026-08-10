import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/FeedbackHost';
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog';
import { QueryErrorState } from '@/components/QueryErrorState';
import { ContentGridSkeleton } from '@/components/ContentGridSkeleton';
import { categoriasService, type CategoriaData } from '@/services/categoriasService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Tag } from 'lucide-react';
import { NovaSubcategoriaModal } from '@/components/Categorias/NovaSubcategoriaModal';
import { useAuth } from '@/contexts/AuthContext';

export function Categorias(): React.ReactElement {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; nome: string } | null>(null);

  const { data: categorias = [], isLoading, isError, isFetching, error: queryError, refetch } = useQuery<CategoriaData[]>({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
  });

  useEffect(() => {
    if (usuario && !isLoading && !isError) localStorage.setItem(`kakebo:categories-reviewed:${usuario.id}`, 'true');
  }, [usuario, isLoading, isError]);

  const deleteMutation = useMutation({
    mutationFn: (subId: string) => categoriasService.deletarSubcategoria(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setPendingDelete(null);
      notify('Subcategoria excluída com sucesso.', 'success');
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || 'Erro ao excluir subcategoria.');
    }
  });

  const categoriasDespesa = categorias.filter(c => c.tipo === 'Despesa');
  const categoriasReceita = categorias.filter(c => c.tipo === 'Receita');

  const handleDelete = (subId: string, nome: string) => {
    setPendingDelete({ id: subId, nome });
  };

  const renderCategoriaCard = (cat: CategoriaData) => (
    <Card key={cat.id} className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              {cat.nome}
            </CardTitle>
            <CardDescription className="mt-1">
              {cat.tipo === 'Despesa' ? `Pilar Kakebo: ${cat.pilar}` : 'Fonte de Renda'}
            </CardDescription>
          </div>
          <NovaSubcategoriaModal categoria={cat} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {cat.subcategorias.map((sub) => (
            <Badge key={sub.id} variant="secondary" className="px-3 py-1 flex items-center gap-1 text-sm font-medium">
              {sub.nome}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${sub.nome}`}
                title={`Excluir ${sub.nome}`}
                className="ml-1 -my-2 -mr-2 hover:bg-transparent hover:text-destructive"
                onClick={() => handleDelete(sub.id, sub.nome)}
                disabled={deleteMutation.isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          {cat.subcategorias.length === 0 && (
            <span className="text-sm text-muted-foreground">Nenhuma subcategoria cadastrada.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Categorias</h1>
        <p className="text-muted-foreground">
          Personalize as subcategorias de despesas (pilares Kakebo) e as suas fontes de receita.
        </p>
      </div>

      {isLoading && <ContentGridSkeleton />}
      {isError && <QueryErrorState error={queryError} title="Erro ao carregar categorias." retrying={isFetching} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Tabs defaultValue="despesas" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="despesas">Despesas (Pilares)</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="despesas" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {categoriasDespesa.map(renderCategoriaCard)}
            </div>
          </TabsContent>
          
          <TabsContent value="receitas" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {categoriasReceita.map(renderCategoriaCard)}
            </div>
          </TabsContent>
        </Tabs>
      )}
      <ConfirmActionDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Excluir subcategoria?"
        description={`A subcategoria “${pendingDelete?.nome ?? ''}” será removida permanentemente.`}
        impact="Lançamentos existentes podem perder esta classificação, afetando filtros e relatórios por categoria."
        pending={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </div>
  );
}

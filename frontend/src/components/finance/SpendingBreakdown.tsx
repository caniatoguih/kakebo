import { useEffect, useMemo, useState } from 'react';
import { CategoryDonutChart, type DonutChartItem } from '@/components/charts/CategoryDonutChart';
import { PercentageBarChart } from '@/components/charts/PercentageBarChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type SpendingCategory = {
  id: string;
  name: string;
  group?: string;
  value: number;
  subcategories: Array<{ id: string; name: string; value: number }>;
};

const CATEGORY_COLORS = Array.from({ length: 8 }, (_, index) => `hsl(var(--chart-category-${index + 1}))`);
const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(value);

export function SpendingBreakdown({ categories, total }: { categories: SpendingCategory[]; total: number }) {
  const sortedCategories = useMemo(
    () => [...categories].filter((category) => category.value > 0).sort((a, b) => b.value - a.value),
    [categories],
  );
  const [selectedId, setSelectedId] = useState(sortedCategories[0]?.id ?? '');

  useEffect(() => {
    if (!sortedCategories.some((category) => category.id === selectedId)) {
      setSelectedId(sortedCategories[0]?.id ?? '');
    }
  }, [selectedId, sortedCategories]);

  const selectedIndex = Math.max(0, sortedCategories.findIndex((category) => category.id === selectedId));
  const selectedCategory = sortedCategories[selectedIndex];
  const chartItems: DonutChartItem[] = sortedCategories.map((category, index) => ({
    id: category.id,
    label: category.name,
    detail: category.group,
    value: category.value,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
  const selectedColor = CATEGORY_COLORS[selectedIndex % CATEGORY_COLORS.length];
  const subcategories = selectedCategory
    ? [...selectedCategory.subcategories].filter((subcategory) => subcategory.value > 0).sort((a, b) => b.value - a.value).map((subcategory) => ({
      id: subcategory.id,
      label: subcategory.name,
      value: subcategory.value,
    }))
    : [];

  if (!selectedCategory || total <= 0) return null;

  return <Card className="min-w-0" aria-labelledby="spending-breakdown-title">
    <CardHeader>
      <CardTitle id="spending-breakdown-title">Para onde foi seu dinheiro?</CardTitle>
      <CardDescription>Selecione uma categoria para entender como as subcategorias participaram dos gastos pagos no mês.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:items-start">
      <section className="min-w-0" aria-labelledby="category-distribution-title">
        <div className="mb-4">
          <h3 id="category-distribution-title" className="font-display text-base font-semibold">Gastos por categoria</h3>
          <p className="mt-1 text-xs text-muted-foreground">Percentual sobre {money(total)} em despesas realizadas.</p>
        </div>
        <CategoryDonutChart items={chartItems} total={total} selectedId={selectedCategory.id} onSelect={setSelectedId} />
      </section>

      <section className="min-w-0 rounded-lg border border-border/60 bg-background/55 p-4 sm:p-5" aria-labelledby="subcategory-distribution-title">
        <div className="mb-5 border-b border-border/70 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Categoria selecionada</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div><h3 id="subcategory-distribution-title" className="font-display text-xl font-bold">{selectedCategory.name}</h3>{selectedCategory.group && <p className="text-xs text-muted-foreground">{selectedCategory.group}</p>}</div>
            <strong className="font-display text-lg tabular-nums">{money(selectedCategory.value)}</strong>
          </div>
        </div>
        {subcategories.length > 0
          ? <PercentageBarChart items={subcategories} total={selectedCategory.value} color={selectedColor} />
          : <p className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">Não há subcategorias com gastos realizados nesta categoria.</p>}
      </section>
    </CardContent>
  </Card>;
}

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { transacoesService } from '@/services/transacoesService';
import { contasService, type ContaData } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import { Upload, ArrowRight, ArrowLeft, Check, FileSpreadsheet, AlertTriangle, Download } from 'lucide-react';

interface ParsedRow {
  index: number;
  selected: boolean;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: 'Receita' | 'Despesa' | 'Transferencia';
  status: 'Pago' | 'Pendente';
  conta_id: string;
  subcategoria_id: string;
  conta_destino_id?: string;
}

export function ImportarCSVModal(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [contaId, setContaId] = useState('');
  const [csvText, setCsvText] = useState('');
  
  // Mapeamentos de Colunas
  const [colData, setColData] = useState('-1');
  const [colDesc, setColDesc] = useState('-1');
  const [colValor, setColValor] = useState('-1');
  const [colTipo, setColTipo] = useState('-1'); // -1 significa auto-detectar pelo sinal
  const [colStatus, setColStatus] = useState('-1'); // -1 significa não mapeado (padrão Pago)
  const [colConta, setColConta] = useState('-1'); // -1 significa não mapeado (padrão fallback)
  const [colSubcategoria, setColSubcategoria] = useState('-1'); // -1 significa não mapeado
  const [subcategoriaPadraoId, setSubcategoriaPadraoId] = useState('');

  // Transações prontas para o preview
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);

  const queryClient = useQueryClient();

  // Busca contas e categorias
  const { data: contas = [] } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
    enabled: open,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
    enabled: open,
  });

  // Lista plana de subcategorias para facilitar busca
  const subcategoriasList = useMemo(() => {
    const list: Array<{ id: string; nome: string; categoriaNome: string }> = [];
    categorias.forEach((cat: any) => {
      cat.subcategorias?.forEach((sub: any) => {
        list.push({
          id: sub.id,
          nome: sub.nome,
          categoriaNome: cat.nome
        });
      });
    });
    return list;
  }, [categorias]);

  // Seletor padrão de subcategoria na primeira carga
  useMemo(() => {
    if (subcategoriasList.length > 0 && !subcategoriaPadraoId) {
      setSubcategoriaPadraoId(subcategoriasList[0].id);
    }
  }, [subcategoriasList, subcategoriaPadraoId]);

  // Parse inicial do CSV para extrair cabeçalho e preview bruto
  const parsedCSV = useMemo(() => {
    if (!csvText) return { headers: [], previewRows: [] };

    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], previewRows: [] };

    // Auto-detecta delimitador (, ou ;)
    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolons > commas ? ';' : ',';

    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]);
    const previewDataRows = lines.slice(1, 6).map(line => parseLine(line));

    return { headers, previewRows: previewDataRows, lines, parseLine };
  }, [csvText]);

  // Handle upload and auto-detect encoding (UTF-8 vs ISO-8859-1)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) return;
        
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Validador de bytes UTF-8 nativo
        let isUTF8 = true;
        let i = 0;
        const len = uint8Array.length;
        
        while (i < len) {
          const b = uint8Array[i];
          if (b <= 0x7F) {
            i++;
          } else if ((b & 0xE0) === 0xC0) {
            if (i + 1 >= len || (uint8Array[i+1] & 0xC0) !== 0x80) {
              isUTF8 = false;
              break;
            }
            i += 2;
          } else if ((b & 0xF0) === 0xE0) {
            if (i + 2 >= len || (uint8Array[i+1] & 0xC0) !== 0x80 || (uint8Array[i+2] & 0xC0) !== 0x80) {
              isUTF8 = false;
              break;
            }
            i += 3;
          } else if ((b & 0xF8) === 0xF0) {
            if (i + 3 >= len || (uint8Array[i+1] & 0xC0) !== 0x80 || (uint8Array[i+2] & 0xC0) !== 0x80 || (uint8Array[i+3] & 0xC0) !== 0x80) {
              isUTF8 = false;
              break;
            }
            i += 4;
          } else {
            isUTF8 = false;
            break;
          }
        }

        const detectedEncoding = isUTF8 ? 'utf-8' : 'iso-8859-1';
        console.log(`Auto-detected encoding: ${detectedEncoding.toUpperCase()}`);
        const decoder = new TextDecoder(detectedEncoding);
        const text = decoder.decode(uint8Array);
        
        setCsvText(text);
        setStep(2); // Avança automaticamente para o mapeamento
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  // Tenta converter string de valor para número
  const parseValor = (valStr: string): number => {
    if (!valStr) return 0;
    let clean = valStr.replace(/[R$\s]/g, '');
    
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Tenta converter data de diferentes formatos para YYYY-MM-DD
  const parseData = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const clean = dateStr.trim();
    
    const brMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [_, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[0];
    }

    try {
      const date = new Date(clean);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (_) {}

    return new Date().toISOString().split('T')[0];
  };

  // Processa todas as linhas do CSV com base no mapeamento e vai para o preview
  const handleMapColumns = () => {
    if (colData === '-1' || colDesc === '-1' || colValor === '-1') {
      alert('Por favor, selecione as colunas correspondentes à Data, Descrição e Valor.');
      return;
    }

    const { lines, parseLine } = parsedCSV;
    if (!lines || lines.length <= 1) return;

    const idxData = parseInt(colData);
    const idxDesc = parseInt(colDesc);
    const idxValor = parseInt(colValor);
    const idxTipo = parseInt(colTipo);
    const idxSubcategoria = parseInt(colSubcategoria);
    const idxStatus = parseInt(colStatus);
    const idxConta = parseInt(colConta);

    const rows: ParsedRow[] = [];

    lines.slice(1).forEach((line, index) => {
      const cols = parseLine(line);
      if (cols.length <= Math.max(idxData, idxDesc, idxValor)) return;

      const rawVal = cols[idxValor];
      const parsedVal = parseValor(rawVal);
      const absValor = Math.abs(parsedVal);
      
      // Auto-detecção de tipo: se a descrição ou o tipo contiver palavras chaves de transferência, Ted ou Pix
      let tipo: 'Receita' | 'Despesa' | 'Transferencia' = 'Despesa';
      const desc = cols[idxDesc] || 'Transação Importada';
      const lowerDesc = desc.toLowerCase();

      if (idxTipo !== -1 && cols[idxTipo]) {
        const tStr = cols[idxTipo].toLowerCase();
        if (tStr.includes('transfer') || tStr.includes('pix') || tStr.includes('ted') || tStr.includes('doc')) {
          tipo = 'Transferencia';
        } else if (tStr.includes('receita') || tStr.includes('c') || tStr.includes('entrada') || tStr.includes('crédito') || tStr.includes('credito')) {
          tipo = 'Receita';
        }
      } else {
        if (lowerDesc.includes('transfer') || lowerDesc.includes('pix p/') || lowerDesc.includes('ted p/') || lowerDesc.includes('ted rec') || lowerDesc.includes('pix rec')) {
          tipo = 'Transferencia';
        } else {
          tipo = parsedVal < 0 ? 'Despesa' : 'Receita';
        }
      }

      const parsedDate = parseData(cols[idxData]);

      // Detecta o status se a coluna de status estiver mapeada
      let status: 'Pago' | 'Pendente' = 'Pago';
      if (idxStatus !== -1 && cols[idxStatus]) {
        const sStr = cols[idxStatus].toLowerCase().trim();
        if (sStr.includes('pendente') || sStr.includes('aberto') || sStr.includes('não pago') || sStr.includes('nao pago') || sStr.includes('unpaid') || sStr.includes('pending') || sStr === 'p' || sStr === '0' || sStr === 'false') {
          status = 'Pendente';
        } else if (sStr.includes('pago') || sStr.includes('confirmado') || sStr.includes('liquido') || sStr.includes('paid') || sStr === 'c' || sStr === '1' || sStr === 'true') {
          status = 'Pago';
        }
      }

      // Tenta mapear subcategoria a partir do arquivo CSV se mapeado
      let subcategoria_id = subcategoriaPadraoId;
      let matchedByCsv = false;

      if (idxSubcategoria !== -1 && cols[idxSubcategoria]) {
        const targetSubName = cols[idxSubcategoria].trim().toLowerCase();
        const matched = subcategoriasList.find(sub => 
          sub.nome.toLowerCase() === targetSubName ||
          sub.nome.toLowerCase().includes(targetSubName) ||
          targetSubName.includes(sub.nome.toLowerCase())
        );
        if (matched) {
          subcategoria_id = matched.id;
          matchedByCsv = true;
        }
      }

      // Se não mapeou por coluna de subcategoria, faz busca inteligente por descrição
      if (!matchedByCsv) {
        const matchedSub = subcategoriasList.find(sub => 
          lowerDesc.includes(sub.nome.toLowerCase()) || sub.nome.toLowerCase().includes(lowerDesc)
        );
        if (matchedSub) {
          subcategoria_id = matchedSub.id;
        }
      }

      // Detecta a conta de origem se a coluna de conta estiver mapeada
      let rowContaId = contaId;
      if (idxConta !== -1 && cols[idxConta]) {
        const cStr = cols[idxConta].toLowerCase().trim();
        const matchedConta = contas.find(c => 
          c.nome.toLowerCase() === cStr ||
          c.nome.toLowerCase().includes(cStr) ||
          cStr.includes(c.nome.toLowerCase())
        );
        if (matchedConta) {
          rowContaId = matchedConta.id!;
        }
      }

      const otherContasForRow = contas.filter(c => c.id !== rowContaId);
      const rowDefaultContaDestinoId = otherContasForRow[0]?.id || '';

      rows.push({
        index,
        selected: true,
        data_transacao: parsedDate,
        descricao: desc,
        valor: absValor,
        tipo,
        status,
        conta_id: rowContaId,
        subcategoria_id,
        conta_destino_id: tipo === 'Transferencia' ? rowDefaultContaDestinoId : undefined
      });
    });

    setPreviewRows(rows);
    setStep(3);
  };

  // Mutation para importar em massa (executa em paralelo para múltiplas contas)
  const importMutation = useMutation({
    mutationFn: async (payloads: Array<{ conta_id: string; transacoes: any[] }>) => {
      const promises = payloads.map(p => transacoesService.importar(p.conta_id, p.transacoes));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
      setOpen(false);
      resetModal();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao importar transações.');
    }
  });

  const handleImportSubmit = async () => {
    const selectedRows = previewRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert('Selecione pelo menos uma transação para importar.');
      return;
    }

    // Agrupa transações por conta_id para importação em lote por conta
    const grouped: Record<string, any[]> = {};
    selectedRows.forEach(r => {
      if (!grouped[r.conta_id]) {
        grouped[r.conta_id] = [];
      }
      grouped[r.conta_id].push({
        data_transacao: new Date(r.data_transacao).toISOString(),
        descricao: r.descricao,
        valor: r.valor,
        tipo: r.tipo,
        status: r.status,
        subcategoria_id: r.tipo === 'Transferencia' ? null : r.subcategoria_id,
        conta_destino_id: r.tipo === 'Transferencia' ? r.conta_destino_id : undefined
      });
    });

    const payloads = Object.entries(grouped).map(([cId, transacoes]) => ({
      conta_id: cId,
      transacoes
    }));

    importMutation.mutate(payloads);
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setContaId('');
    setCsvText('');
    setColData('-1');
    setColDesc('-1');
    setColValor('-1');
    setColTipo('-1');
    setColStatus('-1');
    setColConta('-1');
    setColSubcategoria('-1');
    setPreviewRows([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetModal();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          Importar CSV
        </Button>
      </DialogTrigger>
      
      <DialogContent className={`border-border flex flex-col ${step === 3 ? 'sm:max-w-[950px] h-[85vh]' : 'sm:max-w-[480px]'}`}>
        <DialogHeader>
          <DialogTitle>Importar Transações via CSV</DialogTitle>
          <DialogDescription>
            {step === 1 && "Selecione um extrato CSV e defina a conta bancária padrão para os lançamentos."}
            {step === 2 && "Configure o mapeamento de colunas do seu CSV."}
            {step === 3 && "Revise, categorize, defina transferências e edite seus lançamentos antes de salvar."}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Selecionar Arquivo e Conta */}
        {step === 1 && (
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Conta Bancária Padrão (Fallback)</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta padrão de destino" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id!}>{c.nome} ({c.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label>Arquivo CSV do Banco/Excel</Label>
                <a href="/exemplo_importacao.csv" download className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                  <Download className="h-3.5 w-3.5" /> Baixar arquivo de exemplo
                </a>
              </div>
              <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:bg-accent/50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  disabled={!contaId}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Upload className={`h-8 w-8 ${contaId ? 'text-primary' : 'text-muted-foreground/30'}`} />
                <p className="text-sm font-medium">{file ? file.name : "Clique ou arraste o arquivo .csv aqui"}</p>
                <p className="text-xs text-muted-foreground">{file ? "Arquivo pronto para mapeamento" : "O separador (, ou ;) e o encoding (UTF-8 ou ISO-8859-1) serão auto-detectados"}</p>
                {!contaId && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 mt-2 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Selecione uma conta bancária antes de enviar.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/35 border border-border/80 rounded-lg p-4 space-y-3 text-xs leading-relaxed">
              <h3 className="font-semibold flex items-center gap-1.5 text-foreground text-[13px]">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Guia de Importação Inteligente
              </h3>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>
                  <strong className="text-foreground">Codificação Automática:</strong> Detecta arquivos em <code className="bg-muted px-1 py-0.5 rounded">UTF-8</code> e <code className="bg-muted px-1 py-0.5 rounded">ISO-8859-1</code> (comum em exports de bancos brasileiros como Itaú e Bradesco), evitando textos corrompidos.
                </li>
                <li>
                  <strong className="text-foreground">Separadores Suportados:</strong> Aceita delimitadores por vírgula (<code className="bg-muted px-1 py-0.5 rounded">,</code>) ou ponto e vírgula (<code className="bg-muted px-1 py-0.5 rounded">;</code>).
                </li>
                <li>
                  <strong className="text-foreground">Subcategorias:</strong> Se o arquivo contiver uma coluna com subcategorias, você poderá mapeá-la para autodeclaração.
                </li>
                <li>
                  <strong className="text-foreground">Transferências entre Contas:</strong> Ao mudar o tipo de uma linha para <span className="text-amber-600 dark:text-amber-500 font-medium">Transferência</span> no Passo 3, você poderá escolher uma conta de destino. O saldo das duas contas será atualizado de forma consistente no banco.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2: Mapear Colunas */}
        {step === 2 && (
          <div className="space-y-4 py-2 overflow-y-auto max-h-[50vh]">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Mapeie as colunas de acordo com o cabeçalho do seu arquivo para garantir que as datas, valores e subcategorias sejam importados corretamente.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Coluna de Data *</Label>
                <Select value={colData} onValueChange={setColData}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Coluna de Descrição *</Label>
                <Select value={colDesc} onValueChange={setColDesc}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Coluna de Valor *</Label>
                <Select value={colValor} onValueChange={setColValor}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Coluna de Tipo (Opcional)</Label>
                <Select value={colTipo} onValueChange={setColTipo}>
                  <SelectTrigger><SelectValue placeholder="Auto-detectar pelo sinal (+/-)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Auto-detectar pelo sinal (+/-)</SelectItem>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Coluna de Status (Opcional)</Label>
                <Select value={colStatus} onValueChange={setColStatus}>
                  <SelectTrigger><SelectValue placeholder="Não mapeado (Padrão Pago)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Não mapeado (Padrão Pago)</SelectItem>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Coluna de Conta (Opcional)</Label>
                <Select value={colConta} onValueChange={setColConta}>
                  <SelectTrigger><SelectValue placeholder="Não mapeado (Padrão Fallback)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Não mapeado (Padrão Fallback)</SelectItem>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Coluna de Subcategoria (Opcional)</Label>
                <Select value={colSubcategoria} onValueChange={setColSubcategoria}>
                  <SelectTrigger><SelectValue placeholder="Não mapeado (tentará ler da descrição)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Não mapeado (tentará ler da descrição)</SelectItem>
                    {parsedCSV.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Coluna ${i+1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <Label>Subcategoria Padrão (Fallback)</Label>
              <Select value={subcategoriaPadraoId} onValueChange={setSubcategoriaPadraoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria padrão" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat: any) => (
                    <SelectGroup key={cat.id}>
                      <span className="px-2 py-1.5 text-xs font-semibold text-muted-foreground block">{cat.nome}</span>
                      {cat.subcategorias?.map((sub: any) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Esta subcategoria será usada caso o importador não consiga ler a coluna de subcategorias ou auto-detectar por semelhança.</p>
            </div>

            {/* Tabela de Amostra */}
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-2 text-xs font-semibold border-b">Amostra dos Dados (Primeiras 5 linhas)</div>
              <div className="overflow-x-auto text-[11px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      {parsedCSV.headers.map((h, i) => (
                        <th key={i} className="p-2 text-left font-medium border-r last:border-0">{h || `Col ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCSV.previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b last:border-0 hover:bg-accent/20">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 border-r last:border-0 max-w-[120px] truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Preview Geral, Categorias & Contas de Destino */}
        {step === 3 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 py-2 space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-3 py-2 rounded-lg text-xs flex items-center justify-between">
              <span>
                Sucesso! Processamos <strong>{previewRows.length}</strong> transações. Marque as linhas que deseja importar e revise a subcategoria correspondente ou conta destino.
              </span>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="p-3 text-left w-12"><input 
                      type="checkbox" 
                      checked={previewRows.every(r => r.selected)}
                      onChange={(e) => setPreviewRows(previewRows.map(r => ({ ...r, selected: e.target.checked })))}
                      className="cursor-pointer"
                    /></th>
                    <th className="p-3 text-left w-28">Data</th>
                    <th className="p-3 text-left">Descrição</th>
                    <th className="p-3 text-left w-28">Tipo</th>
                    <th className="p-3 text-left w-28">Status</th>
                    <th className="p-3 text-left w-40">Conta</th>
                    <th className="p-3 text-right w-24">Valor</th>
                    <th className="p-3 text-left w-48">Subcategoria / Conta Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-accent/20 ${!row.selected && 'opacity-50'}`}>
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          checked={row.selected}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].selected = e.target.checked;
                            setPreviewRows(updated);
                          }}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          type="date" 
                          value={row.data_transacao}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].data_transacao = e.target.value;
                            setPreviewRows(updated);
                          }}
                          className="h-8 py-0 px-2 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          type="text" 
                          value={row.descricao}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].descricao = e.target.value;
                            setPreviewRows(updated);
                          }}
                          className="h-8 py-0 px-2 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Select 
                          value={row.tipo} 
                          onValueChange={(val: any) => {
                            const updated = [...previewRows];
                            updated[idx].tipo = val;
                            if (val === 'Transferencia' && !updated[idx].conta_destino_id) {
                              const otherContas = contas.filter(c => c.id !== contaId);
                              updated[idx].conta_destino_id = otherContas[0]?.id || '';
                            }
                            setPreviewRows(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Receita">Receita</SelectItem>
                            <SelectItem value="Despesa">Despesa</SelectItem>
                            <SelectItem value="Transferencia">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select 
                          value={row.status} 
                          onValueChange={(val: 'Pago' | 'Pendente') => {
                            const updated = [...previewRows];
                            updated[idx].status = val;
                            setPreviewRows(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pago">Pago</SelectItem>
                            <SelectItem value="Pendente">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select 
                          value={row.conta_id} 
                          onValueChange={(val) => {
                            const updated = [...previewRows];
                            updated[idx].conta_id = val;
                            if (updated[idx].tipo === 'Transferencia' && updated[idx].conta_destino_id === val) {
                              const otherContas = contas.filter(c => c.id !== val);
                              updated[idx].conta_destino_id = otherContas[0]?.id || '';
                            }
                            setPreviewRows(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {contas.map((c) => (
                              <SelectItem key={c.id} value={c.id!}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-right">
                        <Input 
                          type="number" 
                          value={row.valor}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].valor = parseFloat(e.target.value) || 0;
                            setPreviewRows(updated);
                          }}
                          className="h-8 py-0 px-2 text-xs text-right w-24"
                        />
                      </td>
                      <td className="p-2">
                        {row.tipo === 'Transferencia' ? (
                          <Select 
                            value={row.conta_destino_id} 
                            onValueChange={(val) => {
                              const updated = [...previewRows];
                              updated[idx].conta_destino_id = val;
                              setPreviewRows(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs border-amber-500/50 focus:border-amber-500 bg-amber-500/5">
                              <SelectValue placeholder="Conta Destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {contas.filter(c => c.id !== row.conta_id).map((c) => (
                                <SelectItem key={c.id} value={c.id!}>{c.nome} ({c.tipo})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select 
                            value={row.subcategoria_id} 
                            onValueChange={(val) => {
                              const updated = [...previewRows];
                              updated[idx].subcategoria_id = val;
                              setPreviewRows(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categorias.map((cat: any) => (
                                <SelectGroup key={cat.id}>
                                  <span className="px-2 py-1 text-[10px] font-semibold text-muted-foreground block">{cat.nome}</span>
                                  {cat.subcategorias?.map((sub: any) => (
                                    <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between w-full">
          {step === 1 && (
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button size="sm" onClick={handleMapColumns} className="gap-1.5">
                Avançar <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Mapeamento
              </Button>
              <Button 
                size="sm" 
                onClick={handleImportSubmit} 
                disabled={importMutation.isPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {importMutation.isPending ? 'Importando...' : (
                  <>
                    <Check className="h-4 w-4" /> 
                    Importar {previewRows.filter(r => r.selected).length} Lançamentos
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

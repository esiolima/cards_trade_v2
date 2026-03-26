import React, { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Settings2, 
  CheckCircle2, 
  Loader2, 
  Palette, 
  Type, 
  Image as ImageIcon,
  AlertCircle,
  Moon,
  Sun,
  ExternalLink,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CardData {
  id: string;
  template: string;
  data: any;
}

const CardGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGeneratingJornal, setIsGeneratingJornal] = useState(false);
  
  // Opções de Personalização com Persistência (localStorage)
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [lastHeaderName, setLastHeaderName] = useState<string>(() => localStorage.getItem("lastHeaderName") || "");
  const [backgroundColor, setBackgroundColor] = useState<string>(() => localStorage.getItem("backgroundColor") || "#1a365d");
  const [categoryBoxColor, setCategoryBoxColor] = useState<string>(() => localStorage.getItem("categoryBoxColor") || "#2563eb");
  const [footerText, setFooterText] = useState<string>(() => localStorage.getItem("footerText") || "");

  const socketRef = useRef<Socket | null>(null);

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem("backgroundColor", backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    localStorage.setItem("categoryBoxColor", categoryBoxColor);
  }, [categoryBoxColor]);

  useEffect(() => {
    localStorage.setItem("footerText", footerText);
  }, [footerText]);

  useEffect(() => {
    if (headerFile) {
      setLastHeaderName(headerFile.name);
      localStorage.setItem("lastHeaderName", headerFile.name);
    }
  }, [headerFile]);

  useEffect(() => {
    // Usar caminhos relativos para evitar erros de CORS no Railway
    const socketInstance = io({
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true
    });
    
    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Conectado ao servidor via Socket.io");
    });

    socketInstance.on("processProgress", (data: { progress: number }) => {
      setProgress(data.progress);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setIsCompleted(false);
      setProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
    },
    multiple: false
  });

  const handleProcessExcel = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setCards([]);

    try {
      // Usar fetch nativo em vez de tRPC para evitar erros de "Failed to fetch"
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/process-excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao processar planilha");
      }

      const data = await response.json();
      setCards(data.cards);
      setIsCompleted(true);
      setProgress(100);
      toast.success("Planilha processada com sucesso!");
    } catch (error: any) {
      console.error("Erro no processamento:", error);
      toast.error(`Falha no processamento: ${error.message || "Erro de rede"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    if (cards.length === 0) return;
    window.open("/api/download-zip", "_blank");
  };

  const handleGenerateJornal = async () => {
    setIsGeneratingJornal(true);
    try {
      const formData = new FormData();
      if (headerFile) {
        formData.append("header", headerFile);
      }
      formData.append("backgroundColor", backgroundColor);
      formData.append("categoryBoxColor", categoryBoxColor);
      formData.append("footerText", footerText);

      const response = await fetch("/api/generate-jornal", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar jornal");
      }

      // O servidor retorna o PDF para download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jornal_ofertas.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Jornal PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar jornal:", error);
      toast.error("Erro ao gerar o jornal consolidado.");
    } finally {
      setIsGeneratingJornal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a192f] via-[#112240] to-[#0a192f] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm shadow-2xl">
          <div className="space-y-2">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Settings2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-400">
                Gerador de Jornal de Ofertas
              </h1>
            </div>
            <p className="text-blue-200/60 text-lg font-medium">
              Plataforma Inteligente de Automação de Cards
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="rounded-full bg-white/5 border-white/10 hover:bg-white/10">
              <Sun className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Processing Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Step 1: Excel Upload */}
            <Card className="bg-[#112240]/80 border-white/10 shadow-xl backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5">
                <CardTitle className="flex items-center gap-2 text-white">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-sm font-bold">1</span>
                  Escolha sua Planilha
                </CardTitle>
                <CardDescription className="text-blue-200/50">
                  Converta dados Excel em cards PDF profissionais em segundos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                {!isProcessing && !isCompleted ? (
                  <div
                    {...getRootProps()}
                    className={`
                      border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                      ${isDragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-blue-500/50 hover:bg-white/5"}
                    `}
                  >
                    <input {...getInputProps()} />
                    <div className="bg-blue-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Upload className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">
                      {file ? file.name : "Clique ou arraste seu arquivo"}
                    </h3>
                    <p className="text-blue-200/40">Apenas arquivos .xlsx (máximo 10MB)</p>
                  </div>
                ) : isProcessing ? (
                  <div className="space-y-8 py-10 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <Loader2 className="w-24 h-24 text-blue-500 animate-spin opacity-20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-400">{progress}%</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-white">Processando Cards</h3>
                      <Progress value={progress} className="h-3 bg-white/5" />
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <p className="text-2xl font-bold text-blue-400">{Math.round(cards.length || (progress * 30) / 100)}</p>
                          <p className="text-xs text-blue-200/40 uppercase tracking-wider">Processados</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <p className="text-2xl font-bold text-white">30</p>
                          <p className="text-xs text-blue-200/40 uppercase tracking-wider">Total</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <p className="text-2xl font-bold text-blue-200/60">{30 - (cards.length || Math.round((progress * 30) / 100))}</p>
                          <p className="text-xs text-blue-200/40 uppercase tracking-wider">Restantes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-6">
                    <div className="bg-green-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/30">
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-bold text-white">Tudo Pronto!</h3>
                      <p className="text-blue-200/50">Seus cards foram gerados com sucesso.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4">
                      <Button onClick={() => { setFile(null); setIsCompleted(false); setCards([]); }} variant="outline" className="border-white/10 hover:bg-white/5 px-8 py-6 text-lg">
                        Nova Planilha
                      </Button>
                      <Button onClick={handleDownloadZip} className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg shadow-lg shadow-green-500/20">
                        <Download className="w-5 h-5 mr-2" /> Baixar ZIP
                      </Button>
                    </div>
                  </div>
                )}

                {file && !isProcessing && !isCompleted && (
                  <Button onClick={handleProcessExcel} className="w-full py-8 text-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all">
                    Processar Planilha
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Personalization Panel (Always Visible) */}
            <Card className="bg-[#112240]/80 border-white/10 shadow-xl backdrop-blur-md">
              <CardHeader className="border-b border-white/5 bg-white/5">
                <CardTitle className="flex items-center gap-2 text-white">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-sm font-bold">2</span>
                  Personalize seu Jornal
                </CardTitle>
                <CardDescription className="text-blue-200/50">
                  Configure o visual do jornal consolidado (Lembrando suas últimas escolhas)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Header Upload */}
                  <div className="space-y-4">
                    <Label className="text-blue-200/70 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Cabeçalho (Header)
                    </Label>
                    <div 
                      onClick={() => document.getElementById("header-input")?.click()}
                      className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 cursor-pointer transition-all group"
                    >
                      <input 
                        id="header-input" 
                        type="file" 
                        className="hidden" 
                        accept="image/*,.pdf"
                        onChange={(e) => setHeaderFile(e.target.files?.[0] || null)}
                      />
                      <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-medium text-white truncate max-w-full">
                        {headerFile ? headerFile.name : lastHeaderName || "Subir imagem (PDF, PNG, JPG)"}
                      </p>
                      {lastHeaderName && !headerFile && (
                        <p className="text-[10px] text-blue-200/30 mt-1">Usando último arquivo carregado</p>
                      )}
                    </div>
                  </div>

                  {/* Footer Text */}
                  <div className="space-y-4">
                    <Label className="text-blue-200/70 flex items-center gap-2">
                      <Type className="w-4 h-4" /> Texto do Rodapé
                    </Label>
                    <Textarea 
                      placeholder="Deixe em branco para o padrão..."
                      className="bg-white/5 border-white/10 focus:border-blue-500 h-[100px] text-white"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                    />
                    <p className="text-[10px] text-blue-200/30">O sistema ajustará automaticamente a cor (preto/branco) para melhor contraste.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Background Color */}
                  <div className="space-y-4">
                    <Label className="text-blue-200/70 flex items-center gap-2">
                      <Palette className="w-4 h-4" /> Cor de Fundo
                    </Label>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="relative w-12 h-12 rounded-lg border border-white/20 overflow-hidden">
                        <input 
                          type="color" 
                          className="absolute -inset-2 w-16 h-16 cursor-pointer"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                        />
                      </div>
                      <Input 
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="bg-transparent border-none text-lg font-mono text-white focus-visible:ring-0"
                        placeholder="#000000"
                      />
                    </div>
                  </div>

                  {/* Category Box Color */}
                  <div className="space-y-4">
                    <Label className="text-blue-200/70 flex items-center gap-2">
                      <Palette className="w-4 h-4" /> Cor das Categorias
                    </Label>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="relative w-12 h-12 rounded-lg border border-white/20 overflow-hidden">
                        <input 
                          type="color" 
                          className="absolute -inset-2 w-16 h-16 cursor-pointer"
                          value={categoryBoxColor}
                          onChange={(e) => setCategoryBoxColor(e.target.value)}
                        />
                      </div>
                      <Input 
                        value={categoryBoxColor}
                        onChange={(e) => setCategoryBoxColor(e.target.value)}
                        className="bg-transparent border-none text-lg font-mono text-white focus-visible:ring-0"
                        placeholder="#2563eb"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-white/5" />

                <Button 
                  disabled={!isCompleted || isGeneratingJornal}
                  onClick={handleGenerateJornal}
                  className={`w-full py-8 text-xl font-bold transition-all shadow-2xl ${
                    isCompleted 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20" 
                      : "bg-white/5 text-blue-200/20"
                  }`}
                >
                  {isGeneratingJornal ? (
                    <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Gerando PDF...</>
                  ) : !isCompleted ? (
                    "PROCESSE A PLANILHA PRIMEIRO"
                  ) : (
                    "GERAR JORNAL PDF"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            {/* Model Info */}
            <Card className="bg-[#112240]/80 border-white/10 shadow-xl backdrop-blur-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" /> Modelos Suportados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["PROMOÇÃO", "QUEDA DE PREÇO", "CUPOM", "CASHBACK", "BC"].map((modelo) => (
                  <div key={modelo} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <span className="text-sm font-medium text-blue-100">{modelo}</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-500/50" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tips Section */}
            <Card className="bg-[#112240]/80 border-white/10 shadow-xl backdrop-blur-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Info className="w-5 h-5 text-blue-400" /> Dicas de Uso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-blue-200/60">
                  <li className="flex gap-2">• Use nomes de logos que já existem no sistema para correta exibição.</li>
                  <li className="flex gap-2">• A coluna 'categoria' agrupa os cards no jornal automaticamente.</li>
                  <li className="flex gap-2">• O valor da promoção agora se ajusta dinamicamente ao espaço.</li>
                  <li className="flex gap-2">• Customize as cores para combinar com a identidade da sua campanha.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Section */}
        <footer className="pt-12 pb-8 text-center space-y-4">
          <div className="flex justify-center gap-6">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-blue-200/40 px-4 py-1.5 text-[10px] tracking-[0.2em] font-black uppercase">
              DESENVOLVIDO POR ESIO LIMA — VERSÃO 3.0
            </Badge>
          </div>
          <div className="flex justify-center gap-4 text-blue-200/20">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="#" className="hover:text-blue-400 transition-colors"><ExternalLink className="w-4 h-4" /></a>
                </TooltipTrigger>
                <TooltipContent><p>Documentação</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CardGenerator;

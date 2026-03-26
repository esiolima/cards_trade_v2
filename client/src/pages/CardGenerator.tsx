import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Hourglass, 
  Moon, 
  Sun, 
  Image as ImageIcon, 
  FileText, 
  Palette,
  Type,
  Layout
} from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [bgColor, setBgColor] = useState("#5a2d0c");
  const [categoryBoxColor, setCategoryBoxColor] = useState("#1f7a3f");
  const [footerText, setFooterText] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();
  const generateJornalMutation = trpc.card.generateJornal.useMutation();

  useEffect(() => {
    // Usar caminhos relativos para socket.io
    const socket = io({ 
      reconnection: true, 
      reconnectionDelay: 1000, 
      reconnectionDelayMax: 5000, 
      reconnectionAttempts: 5,
      path: "/socket.io"
    });
    socket.on("connect", () => { console.log("Connected to server"); socket.emit("join", sessionId); });
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => { setError(message); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) { setError("Por favor, selecione um arquivo .xlsx válido"); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("O arquivo não pode exceder 10MB"); return; }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
    setOriginalFileName(null);
  };

  const handleHeaderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setHeaderFile(selectedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) { setError("Por favor, selecione um arquivo"); return; }
    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setZipPath(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Usar caminho relativo
      const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadResponse.ok) throw new Error("Erro ao fazer upload do arquivo");
      const { filePath, fileName } = await uploadResponse.json();
      setUploadedFilePath(filePath);
      setOriginalFileName(fileName);
      const result = await generateCardsMutation.mutateAsync({ filePath, sessionId, originalFileName: fileName });
      if (result.success) setZipPath(result.zipPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGerarJornal = async () => {
    if (!uploadedFilePath) {
      setError("Por favor, processe a planilha primeiro");
      return;
    }
    setIsProcessing(true);
    setError(null);

    try {
      let headerPath = undefined;
      if (headerFile) {
        const formData = new FormData();
        formData.append("file", headerFile);
        // Usar caminho relativo
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadResponse.ok) {
          const data = await uploadResponse.json();
          headerPath = data.filePath;
        }
      }

      const result = await generateJornalMutation.mutateAsync({
        filePath: uploadedFilePath,
        sessionId,
        headerPath,
        backgroundColor: bgColor,
        categoryBoxColor,
        footerText: footerText || undefined
      });

      if (result?.jornalPath) {
        // Usar caminho relativo
        window.open(
          `/api/download?zipPath=${encodeURIComponent(result.jornalPath)}`,
          "_blank"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar jornal");
    } finally {
      setIsProcessing(false);
    }
  };

  const bgColorClass = isDark ? "bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950" : "bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100";
  const cardBg = isDark ? "bg-white/10 backdrop-blur-lg border border-white/20" : "bg-white/50 backdrop-blur-lg border border-white/80";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const borderColor = isDark ? "border-white/20" : "border-slate-300/50";
  const accentColor = isDark ? "text-cyan-300" : "text-blue-600";
  const uploadBg = isDark ? "bg-black/20" : "bg-white/30";
  const uploadBorder = isDragging ? (isDark ? 'border-cyan-300' : 'border-blue-600') : (isDark ? "border-white/30 hover:border-white/50" : "border-blue-300/80 hover:border-blue-400");

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500 ${bgColorClass}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center space-x-4">
            <img src="/martins-logo.png" alt="Martins" className="h-12 object-contain" />
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>Gerador de Cards</h1>
              <p className={`text-sm ${textSecondary}`}>Núcleo de Comunicação e Marketing / Trade Martins</p>
            </div>
          </div>
          <button onClick={() => setIsDark(!isDark)} className={`p-3 rounded-full transition-all duration-300 backdrop-blur-sm ${isDark ? "bg-white/10 hover:bg-white/20 text-yellow-400" : "bg-black/10 hover:bg-black/20 text-slate-700"}`}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className={`${cardBg} rounded-2xl p-8 shadow-2xl transition-all duration-300`}>
              
              {!isProcessing && !zipPath && (
                <div className="space-y-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>1. Escolha sua Planilha</h2>
                    <p className={textSecondary}>Converta dados Excel em cards PDF profissionais em segundos</p>
                  </div>
                  <div onClick={() => document.getElementById("file-input")?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${uploadBg} ${uploadBorder}`}>
                    <div className="flex flex-col items-center space-y-3 pointer-events-none">
                      <div className={`p-4 rounded-full ${isDark ? 'bg-black/20' : 'bg-black/5'}`}><Upload className={`w-8 h-8 ${accentColor}`} /></div>
                      <div>
                        <p className={`font-semibold ${textPrimary}`}>Clique ou arraste seu arquivo</p>
                        <p className={`text-sm ${textSecondary} mt-1`}>Apenas arquivos .xlsx (máximo 10MB)</p>
                      </div>
                    </div>
                    <input id="file-input" type="file" accept=".xlsx" onChange={handleInputChange} className="hidden" />
                  </div>
                  {file && (
                    <div className={`${isDark ? 'bg-black/20' : 'bg-black/5'} rounded-lg p-4 flex items-center justify-between border ${borderColor}`}>
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className={`w-5 h-5 ${accentColor}`} />
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{file.name}</p>
                          <p className={`text-sm ${textSecondary}`}>{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setFile(null); setError(null); }} className={`${textSecondary} hover:${textPrimary}`}>Remover</Button>
                    </div>
                  )}
                  {error && (
                    <div className={`${isDark ? 'bg-red-500/20 border-red-400/50' : 'bg-red-500/10 border-red-500/20'} rounded-lg p-4 flex items-start space-x-3`}>
                      <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-300' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
                      <div>
                        <p className={`font-medium ${isDark ? 'text-red-200' : 'text-red-800'}`}>Erro</p>
                        <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleUpload} disabled={!file || isProcessing} className={`w-full text-white py-6 text-lg font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-cyan-500/80 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    Processar Planilha
                  </Button>
                </div>
              )}

              {isProcessing && progress && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${isDark ? "bg-black/20" : "bg-black/5"}`}><div className="animate-spin"><Hourglass className={`w-10 h-10 ${accentColor}`} /></div></div>
                    <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>Processando Cards</h2>
                    <p className={textSecondary}>{progress.currentCard}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm"><span className={`font-medium ${textPrimary}`}>Progresso</span><span className={`font-bold ${accentColor}`}>{progress.percentage}%</span></div>
                    <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? "bg-black/30" : "bg-black/10"}`}><div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width: `${progress.percentage}%` }} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[{ label: "Processados", value: progress.processed }, { label: "Total", value: progress.total }, { label: "Restantes", value: progress.total - progress.processed }].map((stat, i) => (
                      <div key={i} className={`rounded-lg p-4 text-center border ${isDark ? 'bg-black/20 border-white/10' : 'bg-black/5 border-slate-400/20'}`}><p className={`text-2xl font-bold ${accentColor}`}>{stat.value}</p><p className={`text-xs ${textSecondary} mt-1`}>{stat.label}</p></div>
                    ))}
                  </div>
                </div>
              )}

              {!isProcessing && zipPath && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${isDark ? "bg-green-500/20" : "bg-green-500/10"}`}><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
                    <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>Tudo Pronto!</h2>
                    <p className={textSecondary}>Seus cards foram gerados com sucesso.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => { setZipPath(null); setFile(null); setUploadedFilePath(null); }} variant="outline" className={`py-6 ${isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>Nova Planilha</Button>
                    <Button onClick={() => {
                        if (zipPath) {
                            const a = document.createElement("a");
                            a.href = `/api/download?zipPath=${encodeURIComponent(zipPath)}`;
                            a.download = "cards.zip";
                            a.click();
                        }
                    }} className={`py-6 text-white ${isDark ? 'bg-green-600 hover:bg-green-500' : 'bg-green-600 hover:bg-green-700'}`}><Download className="w-5 h-5 mr-2" /> Baixar ZIP</Button>
                  </div>
                </div>
              )}
            </div>

            {/* PERSONALIZAÇÃO SEMPRE VISÍVEL */}
            <div className={`${cardBg} rounded-2xl p-8 shadow-2xl transition-all duration-300 space-y-8`}>
              <div>
                <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>2. Personalize seu Jornal</h2>
                <p className={textSecondary}>Configure o visual do jornal consolidado</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className={`flex items-center space-x-2 ${textPrimary}`}>
                      <Layout className="w-4 h-4" />
                      <span>Cabeçalho (Header)</span>
                    </Label>
                    <div 
                      onClick={() => document.getElementById("header-input")?.click()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${uploadBg} ${headerFile ? 'border-green-500' : borderColor}`}
                    >
                      {headerFile ? (
                        <div className="flex items-center justify-center space-x-2">
                          <ImageIcon className="w-4 h-4 text-green-500" />
                          <span className={`text-sm truncate max-w-[150px] ${textPrimary}`}>{headerFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-1">
                          <Upload className={`w-5 h-5 ${textSecondary}`} />
                          <span className={`text-xs ${textSecondary}`}>Subir imagem (PDF, PNG, JPG)</span>
                        </div>
                      )}
                      <input id="header-input" type="file" accept="image/*,.pdf" onChange={handleHeaderSelect} className="hidden" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className={`flex items-center space-x-2 ${textPrimary}`}>
                      <Palette className="w-4 h-4" />
                      <span>Cor de Fundo</span>
                    </Label>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="color" 
                        value={bgColor} 
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <Input 
                        value={bgColor} 
                        onChange={(e) => setBgColor(e.target.value)}
                        placeholder="#000000"
                        className={`font-mono ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className={`flex items-center space-x-2 ${textPrimary}`}>
                      <Palette className="w-4 h-4" />
                      <span>Cor das Categorias</span>
                    </Label>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="color" 
                        value={categoryBoxColor} 
                        onChange={(e) => setCategoryBoxColor(e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <Input 
                        value={categoryBoxColor} 
                        onChange={(e) => setCategoryBoxColor(e.target.value)}
                        placeholder="#1f7a3f"
                        className={`font-mono ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className={`flex items-center space-x-2 ${textPrimary}`}>
                      <Type className="w-4 h-4" />
                      <span>Texto do Rodapé</span>
                    </Label>
                    <Textarea 
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="Deixe em branco para o padrão..."
                      className={`min-h-[115px] resize-none ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-slate-300'}`}
                    />
                    <p className={`text-[10px] ${textSecondary}`}>O sistema ajustará automaticamente a cor (preto/branco) para melhor contraste.</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleGerarJornal} 
                disabled={!uploadedFilePath || isProcessing}
                className={`w-full py-8 text-xl font-bold rounded-xl transition-all shadow-lg ${isDark ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'} text-white disabled:opacity-50`}
              >
                {uploadedFilePath ? "Gerar Jornal de Ofertas PDF" : "Processe a planilha primeiro"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${cardBg} rounded-2xl p-6 border ${borderColor}`}>
              <h3 className={`font-bold ${textPrimary} mb-4 flex items-center`}><ImageIcon className={`w-5 h-5 mr-2 ${accentColor}`} /> Modelos Suportados</h3>
              <div className="space-y-3">
                {["PROMOÇÃO", "QUEDA DE PREÇO", "CUPOM", "CASHBACK", "BC"].map((tipo, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white/50'} border ${borderColor}`}>
                    <span className={`text-sm font-medium ${textPrimary}`}>{tipo}</span>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className={`${cardBg} rounded-2xl p-6 border ${borderColor}`}>
              <h3 className={`font-bold ${textPrimary} mb-4 flex items-center`}><FileText className={`w-5 h-5 mr-2 ${accentColor}`} /> Dicas</h3>
              <ul className={`text-sm ${textSecondary} space-y-3`}>
                <li className="flex items-start"><span className={`${accentColor} mr-2 font-bold`}>•</span> Use nomes de logos que já existem no sistema.</li>
                <li className="flex items-start"><span className={`${accentColor} mr-2 font-bold`}>•</span> A coluna 'categoria' agrupa os cards no jornal.</li>
                <li className="flex items-start"><span className={`${accentColor} mr-2 font-bold`}>•</span> O valor da promoção agora se ajusta automaticamente.</li>
                <li className="flex items-start"><span className={`${accentColor} mr-2 font-bold`}>•</span> Customize as cores para combinar com sua marca.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

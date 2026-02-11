import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Moon, Sun, ImagePlus } from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => {
      setError(message);
      setIsProcessing(false);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione um arquivo .xlsx válido");
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const { filePath } = await uploadResponse.json();

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId,
      });

      if (result.success) {
        setZipPath(result.zipPath);
      }
    } catch (err) {
      setError("Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setLogoSuccess(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error();

      setLogoSuccess("Logo enviada com sucesso!");
      setLogoFile(null);
    } catch {
      setError("Erro ao enviar logo");
    }
  };

  const bgColor = isDark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 to-blue-50";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <div className={`min-h-screen py-12 px-4 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-16">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>
              Gerador de Cards
            </h1>
            <p className={`text-sm ${textSecondary}`}>
              Para Produção de Jornal de Ofertas
            </p>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-3 rounded-full bg-slate-800 text-yellow-400"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* COLUNA ESQUERDA */}
          <div className="lg:col-span-2">
            <div className={`${cardBg} rounded-2xl p-8 shadow-xl border ${borderColor}`}>

              {/* Upload Excel */}
              {!zipPath && (
                <>
                  <div
                    onClick={() => document.getElementById("file-input")?.click()}
                    className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-4" />
                    <p className={textPrimary}>Clique ou arraste seu .xlsx</p>
                    <input
                      id="file-input"
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {file && (
                    <Button
                      onClick={handleUpload}
                      className="w-full mt-6 bg-blue-600 text-white"
                    >
                      Processar Planilha
                    </Button>
                  )}
                </>
              )}

              {/* Download */}
              {zipPath && (
                <Button
                  onClick={() => window.location.href = `/api/download?zipPath=${zipPath}`}
                  className="w-full bg-green-600 text-white"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Baixar Cards
                </Button>
              )}

            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div className="space-y-4">

            <div className={`${cardBg} rounded-xl p-5 border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary}`}>Download Fácil</h3>
              <p className={`text-sm ${textSecondary}`}>
                Todos os cards em um arquivo ZIP
              </p>
            </div>

            {/* NOVO BLOCO UPLOAD LOGO */}
            <div className={`${cardBg} rounded-xl p-5 border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary} mb-3`}>
                Upload de Logo
              </h3>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />

              {logoFile && (
                <Button
                  onClick={handleLogoUpload}
                  className="w-full mt-4 bg-blue-600 text-white"
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Enviar Logo
                </Button>
              )}

              {logoSuccess && (
                <p className="text-green-500 text-sm mt-2">
                  {logoSuccess}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className={`mt-16 pt-8 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textSecondary}`}>
            Desenvolvido por Esio Lima - Versão 1.0
          </p>
        </div>

      </div>
    </div>
  );
}

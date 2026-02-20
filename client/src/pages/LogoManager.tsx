import { useState, useRef, useEffect } from "react";
import { Upload, AlertCircle, CheckCircle2, ArrowLeft, Sun, Moon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface Logo {
  name: string;
  path: string;
}

export default function LogoManager() {
  const [, navigate] = useLocation();

  const [logos, setLogos] = useState<Logo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logosData, refetch } = trpc.logo.listLogos.useQuery();

  useEffect(() => {
    if (logosData?.logos) {
      setLogos(logosData.logos);
    }
  }, [logosData]);

  // ================================
  // DELETE LOGO
  // ================================
  const handleDelete = async (logoName: string) => {
    const confirmDelete = window.confirm(
      `Deseja realmente excluir ${logoName}?`
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/logos/${logoName}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.error || "Erro ao excluir logo");
        return;
      }

      setSuccess(`Logo "${logoName}" excluída com sucesso!`);
      refetch();
    } catch {
      setError("Erro ao excluir logo");
    }
  };

  // ================================
  // UPLOAD
  // ================================
  const handleFileSelect = async (file: File | null | undefined) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setError("Apenas PNG, JPG e JPEG são permitidos");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo não pode exceder 5MB");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao enviar logo");
      }

      setSuccess(`Logo "${file.name}" enviada com sucesso!`);
      refetch();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  // ================================
  // ESTILOS
  // ================================
  const bgColor = isDark 
    ? "bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950" 
    : "bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100";
  const cardBg = isDark 
    ? "bg-white/10 backdrop-blur-lg border border-white/20" 
    : "bg-white/50 backdrop-blur-lg border border-white/80";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const uploadBg = isDark ? "bg-black/20" : "bg-white/30";
  const uploadBorder = isDragging
    ? (isDark ? 'border-cyan-300' : 'border-blue-600')
    : (isDark ? "border-white/30 hover:border-white/50" : "border-blue-300/80 hover:border-blue-400");

  return (
    <div className={`min-h-screen w-full py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500 ${bgColor}`}>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className={`flex items-center gap-2 transition-all duration-300 ${
              isDark 
                ? 'bg-white/10 border-white/20 text-slate-200 hover:bg-white/20 hover:text-white' 
                : 'bg-black/5 border-slate-400/50 text-slate-700 hover:bg-black/10'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Home
          </Button>

          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-3 rounded-full transition-all duration-300 backdrop-blur-sm ${
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-yellow-400" 
                : "bg-black/10 hover:bg-black/20 text-slate-700"
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Upload Section */}
        <div className={`p-8 rounded-2xl shadow-2xl ${cardBg}`}>
          <h2 className={`text-2xl font-bold ${textPrimary} mb-4`}>
            Gerenciador de Logos
          </h2>

          <div
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${uploadBorder} ${uploadBg} ${isLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            <div className="flex flex-col items-center space-y-3 pointer-events-none">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
              <p className={`${textSecondary} mb-4`}>
                Arraste ou clique para selecionar um arquivo
              </p>
              <Button
                asChild
                disabled={isLoading}
                className={`text-white font-semibold transition-all duration-300 ${isDark ? 'bg-cyan-500/80 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <span>{isLoading ? "Enviando..." : "Selecionar Logo"}</span>
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleInputChange}
              className="hidden"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={`flex items-center gap-2 p-4 mt-4 rounded-lg ${isDark ? 'bg-red-500/20 border border-red-400/50 text-red-300' : 'bg-red-500/10 border border-red-500/20 text-red-700'}`}>
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className={`flex items-center gap-2 p-4 mt-4 rounded-lg ${isDark ? 'bg-green-500/20 border border-green-400/50 text-green-300' : 'bg-green-500/10 border border-green-500/20 text-green-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
              {success}
            </div>
          )}
        </div>

        {/* Logos */}
        <div className={`p-8 rounded-2xl shadow-2xl ${cardBg}`}>
          <h3 className={`text-xl font-bold ${textPrimary} mb-4`}>
            Logos Disponíveis
          </h3>

          {logos.filter(logo => logo.name !== "blank.png").length === 0 ? (
            <p className={textSecondary}>Nenhum logo disponível</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {logos
                .filter(logo => logo.name !== "blank.png")
                .map((logo) => (
                  <div
                    key={logo.name}
                    className={`relative rounded-lg p-4 transition-all duration-300 border ${isDark ? 'bg-black/20 border-white/10 hover:bg-black/30' : 'bg-black/5 border-slate-400/20 hover:bg-black/10'}`}
                  >
                    {/* BOTÃO DELETE */}
                    <button
                      onClick={() => handleDelete(logo.name)}
                      className="absolute top-2 right-2 opacity-0 hover:scale-110 transition-all duration-200"
                    >
                      <Trash2 className={`w-4 h-4 ${isDark ? "text-red-400" : "text-red-600"}`} />
                    </button>

                    <img
                      src={`/logos/${logo.name}`}
                      alt={logo.name}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/logos/blank.png"; }}
                    />
                    <p className={`text-sm truncate ${textSecondary}`}>
                      {logo.name}
                    </p>

                    <style jsx>{`
                      div:hover > button {
                        opacity: 1;
                      }
                    `}</style>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

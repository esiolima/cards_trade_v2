import { useEffect, useState } from "react";

export default function LogoManager() {
  const [logos, setLogos] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/logos")
      .then((res) => res.json())
      .then((data) => setLogos(data));
  }, []);

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
        alert(error.error || "Erro ao excluir logo.");
        return;
      }

      setLogos((prev) =>
        prev.filter((item) => item !== logoName)
      );
    } catch {
      alert("Erro ao excluir logo.");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Gerenciamento de Logos</h2>

      <div className="grid">
        {logos.map((logo) => (
          <div key={logo} className="logo-card">
            <img src={`/logos/${logo}`} alt={logo} />

            {/* Não mostrar lixeira para blank.png */}
            {logo.toLowerCase() !== "blank.png" && (
              <div
                className="delete-overlay"
                onClick={() => handleDelete(logo)}
              >
                🗑
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, 180px);
          gap: 20px;
          margin-top: 30px;
        }

        .logo-card {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #ddd;
          background: #fff;
          cursor: pointer;
        }

        .logo-card img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 15px;
        }

        .delete-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          color: white;
          opacity: 0;
          transition: 0.2s ease;
        }

        .logo-card:hover .delete-overlay {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

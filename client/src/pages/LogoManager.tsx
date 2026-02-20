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
    <div className="logo-manager-container">
      <h2>Gerenciamento de Logos</h2>

      <div className="logo-grid">
        {logos.map((logo) => (
          <div key={logo} className="logo-item">
            <img src={`/logos/${logo}`} alt={logo} />

            {logo.toLowerCase() !== "blank.png" && (
              <button
                className="delete-button"
                onClick={() => handleDelete(logo)}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .logo-manager-container {
          padding: 40px;
        }

        .logo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, 160px);
          gap: 20px;
          margin-top: 20px;
        }

        .logo-item {
          position: relative;
          border-radius: 10px;
          background: white;
          border: 1px solid #e5e5e5;
          padding: 15px;
        }

        .logo-item img {
          width: 100%;
          height: 120px;
          object-fit: contain;
        }

        .delete-button {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0,0,0,0.7);
          border: none;
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          cursor: pointer;
          opacity: 0;
          transition: 0.2s ease;
        }

        .logo-item:hover .delete-button {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

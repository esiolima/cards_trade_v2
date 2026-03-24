export function renderJornalTeste() {
  return `
  <html>
    <head>
      <style>
        body {
          margin: 0;
          background: #5a2d0c;
          font-family: Arial, sans-serif;
        }

        .container {
          padding: 40px;
        }

        .header img {
          width: 100%;
          border-radius: 16px;
        }

        .categoria {
          margin-top: 40px;
        }

        .tarja {
          background: #1f7a3f;
          color: white;
          padding: 12px 24px;
          border-radius: 999px;
          font-weight: bold;
          text-align: center;
          width: fit-content;
          margin: 0 auto 24px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .card {
          background: white;
          border-radius: 16px;
          height: 300px;
        }
      </style>
    </head>

    <body>
      <div class="container">

        <div class="header">
          <img src="https://via.placeholder.com/1200x300" />
        </div>

        ${renderCategoriaTeste("MERCEARIA")}
        ${renderCategoriaTeste("BALAS E DOCES")}

      </div>
    </body>
  </html>
  `;
}

function renderCategoriaTeste(nome: string) {
  return `
    <div class="categoria">
      <div class="tarja">${nome}</div>

      <div class="grid">
        ${renderCardTeste()}
        ${renderCardTeste()}
        ${renderCardTeste()}
        ${renderCardTeste()}
        ${renderCardTeste()}
        ${renderCardTeste()}
      </div>
    </div>
  `;
}

function renderCardTeste() {
  return `<div class="card"></div>`;
}

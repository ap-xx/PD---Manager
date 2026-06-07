# PD Manager

Gerenciador de estoque para o jogo **Project Delta** (Roblox). Permite cadastrar os itens
que você possui, em qual conta cada um está (`notakxz`, `RepairKitMan`, `megagabriel10`),
a quantidade e o preço unitário em **Rubles (₽)** — a economia do jogo, baseada em valores
inteiros — calculando automaticamente o total de cada item e os totais por conta e geral.

## Como usar

Projeto em **TypeScript + Vite**. É necessário ter o [Node.js](https://nodejs.org) instalado.

```sh
npm install   # instala as dependências (apenas na primeira vez)
npm run dev   # inicia o servidor de desenvolvimento em http://localhost:5500
```

Para gerar uma versão de produção (estática, pronta para hospedar em qualquer lugar):

```sh
npm run build     # gera a pasta dist/
npm run preview   # serve a pasta dist/ localmente para conferir
```

Não há backend — os dados ficam salvos no `localStorage` do navegador.

### Funcionalidades

- **Catálogo de itens**: gerado automaticamente a partir dos ícones em `public/icons/`
  (Equipment, Loot, Rations, Weapons — incl. Parts — Wearables e suas sub/grupos).
- **Seletor de itens em grade**: busque e escolha o item num painel com ícones grandes,
  agrupados por categoria/subcategoria/grupo.
- **Cadastro de estoque**: escolha o item, a conta, a quantidade e o preço unitário em
  Rubles (sempre números inteiros) — o total é calculado na hora.
- **Busca e filtros**: por nome do item, conta, categoria, subcategoria e grupo.
- **Totais**: valor total em estoque, total por conta e total por item (quantidade × preço).
- **Exportar / Importar**: backup dos dados em `.json`.

### Atualizando o catálogo de itens

Se novos ícones forem adicionados em `public/icons/`, regenere o catálogo com:

```sh
npm run generate-items
```

Isso reescreve [src/items.ts](src/items.ts) com a lista atualizada de itens.

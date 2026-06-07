# PD Manager

Gerenciador de estoque para o jogo **Project Delta** (Roblox). Permite cadastrar os itens
que você possui, em qual conta cada um está (`notakxz`, `RepairKitMan`, `megagabriel10`),
a quantidade e o preço unitário — calculando automaticamente o total de cada item e os
totais por conta e geral.

## Como usar

Basta abrir o [index.html](index.html) em um navegador (ou servir a pasta com qualquer
servidor estático). Não há backend nem instalação — os dados ficam salvos no
`localStorage` do navegador.

### Funcionalidades

- **Catálogo de itens**: gerado automaticamente a partir dos ícones em `icons/`
  (Equipment, Loot, Rations, Weapons, Wearables e suas subcategorias).
- **Cadastro de estoque**: escolha o item (com busca e ícone), a conta, a quantidade e
  o preço unitário — o total é calculado na hora.
- **Busca e filtros**: por nome do item, conta, categoria e subcategoria.
- **Totais**: valor total em estoque, total por conta e total por item (quantidade × preço).
- **Exportar / Importar**: backup dos dados em `.json`.

### Atualizando o catálogo de itens

Se novos ícones forem adicionados em `icons/`, regenere o catálogo com:

```sh
node scripts/generate-items.mjs
```

Isso reescreve [js/items.js](js/items.js) com a lista atualizada de itens.

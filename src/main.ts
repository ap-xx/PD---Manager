import './style.css';
import { ITEM_CATALOG } from './items';
import type { Account, Item, StockEntry } from './types';

const ACCOUNTS: Account[] = ['notakxz', 'RepairKitMan', 'megagabriel10'];
const STORAGE_KEY = 'pd-manager-stock-v1';

const itemsById = new Map<string, Item>(ITEM_CATALOG.map((item) => [item.id, item]));

let stock: StockEntry[] = loadStock();

// ---------- Storage ----------

function loadStock(): StockEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch (err) {
    console.warn('Falha ao carregar estoque salvo:', err);
    return [];
  }
}

function isValidEntry(entry: unknown): entry is StockEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === 'string'
    && typeof e.itemId === 'string'
    && itemsById.has(e.itemId)
    && typeof e.account === 'string'
    && (ACCOUNTS as string[]).includes(e.account)
    && Number.isFinite(e.quantity)
    && Number.isFinite(e.price);
}

function saveStock(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
}

function makeId(): string {
  return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------- Formatting ----------
// Rubles (₽) is Project Delta's economy and it only deals in whole numbers — no decimals anywhere.

const integerFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

function formatNumber(value: number): string {
  return integerFormat.format(Math.round(value));
}

function formatRubles(value: number): string {
  return `${integerFormat.format(Math.round(value))} ₽`;
}

function entryTotal(entry: StockEntry): number {
  return entry.quantity * entry.price;
}

function itemBreadcrumb(item: Item): string {
  return [item.category, item.subcategory, item.group].filter(Boolean).join(' • ');
}

// ---------- DOM refs ----------

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el as T;
}

const els = {
  summaryCards: byId<HTMLDivElement>('summary-cards'),
  searchInput: byId<HTMLInputElement>('search-input'),
  accountFilter: byId<HTMLSelectElement>('account-filter'),
  categoryFilter: byId<HTMLSelectElement>('category-filter'),
  subcategoryFilter: byId<HTMLSelectElement>('subcategory-filter'),
  groupFilter: byId<HTMLSelectElement>('group-filter'),
  clearFiltersBtn: byId<HTMLButtonElement>('clear-filters-btn'),
  addItemBtn: byId<HTMLButtonElement>('add-item-btn'),
  accountTotalsList: byId<HTMLUListElement>('account-totals-list'),
  exportBtn: byId<HTMLButtonElement>('export-btn'),
  importInput: byId<HTMLInputElement>('import-input'),
  resultCount: byId<HTMLSpanElement>('result-count'),
  emptyState: byId<HTMLDivElement>('empty-state'),
  tableBody: byId<HTMLTableSectionElement>('stock-table-body'),

  modalOverlay: byId<HTMLDivElement>('modal-overlay'),
  modalTitle: byId<HTMLHeadingElement>('modal-title'),
  modalCloseBtn: byId<HTMLButtonElement>('modal-close-btn'),
  cancelBtn: byId<HTMLButtonElement>('cancel-btn'),
  form: byId<HTMLFormElement>('stock-form'),
  entryIdInput: byId<HTMLInputElement>('entry-id'),

  itemTrigger: byId<HTMLButtonElement>('item-trigger'),
  itemTriggerPlaceholder: byId<HTMLSpanElement>('item-trigger-placeholder'),
  itemTriggerSelected: byId<HTMLSpanElement>('item-trigger-selected'),
  selectedItemIcon: byId<HTMLImageElement>('selected-item-icon'),
  selectedItemName: byId<HTMLElement>('selected-item-name'),
  selectedItemPath: byId<HTMLSpanElement>('selected-item-path'),
  selectedItemIdInput: byId<HTMLInputElement>('selected-item-id'),

  accountSelect: byId<HTMLSelectElement>('account-select'),
  quantityInput: byId<HTMLInputElement>('quantity-input'),
  priceInput: byId<HTMLInputElement>('price-input'),
  totalPreviewValue: byId<HTMLElement>('total-preview-value'),

  pickerOverlay: byId<HTMLDivElement>('picker-overlay'),
  pickerSearchInput: byId<HTMLInputElement>('picker-search-input'),
  pickerResults: byId<HTMLDivElement>('picker-results'),
  pickerCloseBtn: byId<HTMLButtonElement>('picker-close-btn'),
};

let selectedItemId: string | null = null;

// ---------- Filter option setup ----------

function populateStaticOptions(): void {
  for (const account of ACCOUNTS) {
    els.accountFilter.appendChild(new Option(account, account));
    els.accountSelect.appendChild(new Option(account, account));
  }

  const categories = [...new Set(ITEM_CATALOG.map((item) => item.category))].sort();
  for (const category of categories) {
    els.categoryFilter.appendChild(new Option(category, category));
  }
}

function refreshSubcategoryOptions(): void {
  const selectedCategory = els.categoryFilter.value;
  const current = els.subcategoryFilter.value;

  els.subcategoryFilter.innerHTML = '';
  els.subcategoryFilter.appendChild(new Option('Todas as subcategorias', ''));

  const subcats = [...new Set(
    ITEM_CATALOG
      .filter((item) => (!selectedCategory || item.category === selectedCategory) && item.subcategory)
      .map((item) => item.subcategory as string)
  )].sort();

  for (const sub of subcats) {
    els.subcategoryFilter.appendChild(new Option(sub, sub));
  }

  els.subcategoryFilter.disabled = subcats.length === 0;
  if (subcats.includes(current)) {
    els.subcategoryFilter.value = current;
  }
}

function refreshGroupOptions(): void {
  const selectedCategory = els.categoryFilter.value;
  const selectedSubcategory = els.subcategoryFilter.value;
  const current = els.groupFilter.value;

  els.groupFilter.innerHTML = '';
  els.groupFilter.appendChild(new Option('Todos os grupos', ''));

  const groups = [...new Set(
    ITEM_CATALOG
      .filter((item) => (!selectedCategory || item.category === selectedCategory)
        && (!selectedSubcategory || item.subcategory === selectedSubcategory)
        && item.group)
      .map((item) => item.group as string)
  )].sort();

  for (const group of groups) {
    els.groupFilter.appendChild(new Option(group, group));
  }

  els.groupFilter.disabled = groups.length === 0;
  if (groups.includes(current)) {
    els.groupFilter.value = current;
  }
}

// ---------- Filtering ----------

function getFilteredEntries(): StockEntry[] {
  const query = els.searchInput.value.trim().toLowerCase();
  const account = els.accountFilter.value;
  const category = els.categoryFilter.value;
  const subcategory = els.subcategoryFilter.value;
  const group = els.groupFilter.value;

  return stock.filter((entry) => {
    const item = itemsById.get(entry.itemId);
    if (!item) return false;
    if (account && entry.account !== account) return false;
    if (category && item.category !== category) return false;
    if (subcategory && item.subcategory !== subcategory) return false;
    if (group && item.group !== group) return false;
    if (query) {
      const haystack = `${item.name} ${itemBreadcrumb(item)} ${entry.account}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

// ---------- Rendering ----------

function render(): void {
  renderSummaryCards();
  renderAccountTotals();
  renderTable();
}

function renderSummaryCards(): void {
  const totalValue = stock.reduce((sum, entry) => sum + entryTotal(entry), 0);
  const totalQuantity = stock.reduce((sum, entry) => sum + entry.quantity, 0);
  const distinctItems = new Set(stock.map((entry) => entry.itemId)).size;

  els.summaryCards.innerHTML = '';
  els.summaryCards.append(
    summaryCard('Valor total em estoque', formatRubles(totalValue)),
    summaryCard('Itens distintos', formatNumber(distinctItems)),
    summaryCard('Quantidade total', formatNumber(totalQuantity)),
  );
}

function summaryCard(label: string, value: string): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'summary-card';

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = value;

  card.append(labelEl, valueEl);
  return card;
}

function renderAccountTotals(): void {
  els.accountTotalsList.innerHTML = '';
  for (const account of ACCOUNTS) {
    const total = stock
      .filter((entry) => entry.account === account)
      .reduce((sum, entry) => sum + entryTotal(entry), 0);

    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'acc-name';
    name.textContent = account;

    const value = document.createElement('span');
    value.className = 'acc-value';
    value.textContent = formatRubles(total);

    li.append(name, value);
    els.accountTotalsList.appendChild(li);
  }
}

function renderTable(): void {
  const filtered = getFilteredEntries();

  els.resultCount.textContent = stock.length
    ? `(${filtered.length} de ${stock.length} ${stock.length === 1 ? 'item' : 'itens'})`
    : '';

  els.tableBody.innerHTML = '';

  if (stock.length === 0) {
    setEmptyState('Nenhum item no estoque ainda.');
    return;
  }

  if (filtered.length === 0) {
    setEmptyState('Nenhum item encontrado com os filtros atuais.');
    return;
  }

  els.emptyState.hidden = true;

  const sorted = [...filtered].sort((a, b) => {
    const itemA = itemsById.get(a.itemId)!;
    const itemB = itemsById.get(b.itemId)!;
    return itemA.name.localeCompare(itemB.name) || a.account.localeCompare(b.account);
  });

  for (const entry of sorted) {
    els.tableBody.appendChild(buildRow(entry));
  }
}

function setEmptyState(message: string): void {
  els.emptyState.hidden = false;
  const p = els.emptyState.querySelector('p');
  if (p) p.textContent = message;
}

function buildRow(entry: StockEntry): HTMLTableRowElement {
  const item = itemsById.get(entry.itemId)!;
  const tr = document.createElement('tr');

  const iconTd = document.createElement('td');
  iconTd.className = 'col-icon';
  const img = document.createElement('img');
  img.className = 'row-icon';
  img.src = item.icon;
  img.alt = item.name;
  img.loading = 'lazy';
  iconTd.appendChild(img);

  const nameTd = document.createElement('td');
  const nameWrap = document.createElement('div');
  nameWrap.className = 'item-name-cell';
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = item.name;
  const pathSpan = document.createElement('span');
  pathSpan.className = 'path';
  pathSpan.textContent = itemBreadcrumb(item);
  nameWrap.append(nameStrong, pathSpan);
  nameTd.appendChild(nameWrap);

  const accountTd = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'account-badge';
  badge.dataset.account = entry.account;
  badge.textContent = entry.account;
  accountTd.appendChild(badge);

  const qtyTd = document.createElement('td');
  qtyTd.className = 'col-num';
  qtyTd.textContent = formatNumber(entry.quantity);

  const priceTd = document.createElement('td');
  priceTd.className = 'col-num';
  priceTd.textContent = formatRubles(entry.price);

  const totalTd = document.createElement('td');
  totalTd.className = 'col-num row-total';
  totalTd.textContent = formatRubles(entryTotal(entry));

  const actionsTd = document.createElement('td');
  actionsTd.className = 'col-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary btn-small';
  editBtn.type = 'button';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', () => openModal(entry));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger btn-small';
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Remover';
  deleteBtn.style.marginLeft = '8px';
  deleteBtn.addEventListener('click', () => deleteEntry(entry.id));

  actionsTd.append(editBtn, deleteBtn);

  tr.append(iconTd, nameTd, accountTd, qtyTd, priceTd, totalTd, actionsTd);
  return tr;
}

function deleteEntry(id: string): void {
  const entry = stock.find((e) => e.id === id);
  if (!entry) return;
  const item = itemsById.get(entry.itemId);
  const label = item ? `${item.name} (${entry.account})` : entry.account;
  if (!window.confirm(`Remover "${label}" do estoque?`)) return;
  stock = stock.filter((e) => e.id !== id);
  saveStock();
  render();
}

// ---------- Stock form modal ----------

function openModal(entry: StockEntry | null): void {
  els.form.reset();
  clearSelectedItem();

  if (entry) {
    els.modalTitle.textContent = 'Editar item do estoque';
    els.entryIdInput.value = entry.id;
    selectItem(entry.itemId);
    els.accountSelect.value = entry.account;
    els.quantityInput.value = String(entry.quantity);
    els.priceInput.value = String(entry.price);
  } else {
    els.modalTitle.textContent = 'Adicionar item ao estoque';
    els.entryIdInput.value = '';
    els.accountSelect.value = '';
    els.quantityInput.value = '';
    els.priceInput.value = '';
  }

  updateTotalPreview();
  els.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(): void {
  els.modalOverlay.hidden = true;
  if (els.pickerOverlay.hidden) {
    document.body.style.overflow = '';
  }
}

function clearSelectedItem(): void {
  selectedItemId = null;
  els.selectedItemIdInput.value = '';
  els.itemTriggerSelected.hidden = true;
  els.itemTriggerPlaceholder.hidden = false;
}

function selectItem(itemId: string): void {
  const item = itemsById.get(itemId);
  if (!item) return;
  selectedItemId = itemId;
  els.selectedItemIdInput.value = itemId;
  els.selectedItemIcon.src = item.icon;
  els.selectedItemIcon.alt = item.name;
  els.selectedItemName.textContent = item.name;
  els.selectedItemPath.textContent = itemBreadcrumb(item);
  els.itemTriggerSelected.hidden = false;
  els.itemTriggerPlaceholder.hidden = true;
}

function updateTotalPreview(): void {
  const quantity = Number(els.quantityInput.value) || 0;
  const price = Number(els.priceInput.value) || 0;
  els.totalPreviewValue.textContent = formatRubles(quantity * price);
}

function handleFormSubmit(event: SubmitEvent): void {
  event.preventDefault();

  const itemId = els.selectedItemIdInput.value;
  const account = els.accountSelect.value as Account;
  const quantity = Math.round(Number(els.quantityInput.value));
  const price = Math.round(Number(els.priceInput.value));

  if (!itemId || !itemsById.has(itemId)) {
    window.alert('Selecione um item válido.');
    return;
  }
  if (!account) {
    window.alert('Selecione a conta.');
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    window.alert('Informe uma quantidade válida.');
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    window.alert('Informe um preço válido (Rubles são valores inteiros).');
    return;
  }

  const existingId = els.entryIdInput.value;

  if (existingId) {
    const entry = stock.find((e) => e.id === existingId);
    if (entry) {
      entry.itemId = itemId;
      entry.account = account;
      entry.quantity = quantity;
      entry.price = price;
    }
  } else {
    stock.push({ id: makeId(), itemId, account, quantity, price });
  }

  saveStock();
  closeModal();
  render();
}

// ---------- Item picker overlay (grid, grouped, searchable) ----------

function groupItemsByBreadcrumb(items: Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = itemBreadcrumb(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function openPicker(): void {
  els.pickerSearchInput.value = '';
  renderPickerResults('');
  els.pickerOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => els.pickerSearchInput.focus(), 0);
}

function closePicker(): void {
  els.pickerOverlay.hidden = true;
  if (els.modalOverlay.hidden) {
    document.body.style.overflow = '';
  }
}

function renderPickerResults(query: string): void {
  const trimmed = query.trim().toLowerCase();
  const items = trimmed
    ? ITEM_CATALOG.filter((item) => `${item.name} ${itemBreadcrumb(item)}`.toLowerCase().includes(trimmed))
    : ITEM_CATALOG;

  els.pickerResults.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'picker-empty';
    empty.textContent = 'Nenhum item encontrado.';
    els.pickerResults.appendChild(empty);
    return;
  }

  const groups = groupItemsByBreadcrumb(items);

  for (const [breadcrumb, groupItems] of groups) {
    const section = document.createElement('div');
    section.className = 'picker-group';

    const title = document.createElement('h3');
    title.className = 'picker-group-title';
    title.textContent = breadcrumb;

    const grid = document.createElement('div');
    grid.className = 'picker-grid';

    for (const item of groupItems) {
      grid.appendChild(buildPickerCard(item));
    }

    section.append(title, grid);
    els.pickerResults.appendChild(section);
  }
}

function buildPickerCard(item: Item): HTMLButtonElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'picker-card' + (item.id === selectedItemId ? ' active' : '');

  const img = document.createElement('img');
  img.src = item.icon;
  img.alt = '';
  img.loading = 'lazy';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = item.name;

  card.append(img, name);
  card.addEventListener('click', () => {
    selectItem(item.id);
    closePicker();
  });

  return card;
}

// ---------- Export / Import ----------

function exportData(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    accounts: ACCOUNTS,
    stock,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pd-manager-estoque-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = Array.isArray(parsed) ? parsed : parsed.stock;
      if (!Array.isArray(incoming)) throw new Error('Formato inválido.');

      const validEntries = incoming.filter(isValidEntry);
      if (validEntries.length === 0) {
        window.alert('Nenhum item válido encontrado no arquivo.');
        return;
      }

      const replace = window.confirm(
        `Encontrados ${validEntries.length} itens válidos.\n\n`
        + 'Clique OK para SUBSTITUIR o estoque atual, ou Cancelar para ADICIONAR aos itens existentes.'
      );

      if (replace) {
        stock = validEntries.map((entry) => ({ ...entry }));
      } else {
        const existingIds = new Set(stock.map((e) => e.id));
        for (const entry of validEntries) {
          stock.push(existingIds.has(entry.id) ? { ...entry, id: makeId() } : { ...entry });
        }
      }

      saveStock();
      render();
      window.alert('Importação concluída.');
    } catch (err) {
      console.error(err);
      window.alert('Não foi possível importar o arquivo. Verifique se é um JSON exportado pelo PD Manager.');
    }
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------

function attachEvents(): void {
  els.searchInput.addEventListener('input', renderTable);
  els.accountFilter.addEventListener('change', renderTable);
  els.categoryFilter.addEventListener('change', () => {
    refreshSubcategoryOptions();
    refreshGroupOptions();
    renderTable();
  });
  els.subcategoryFilter.addEventListener('change', () => {
    refreshGroupOptions();
    renderTable();
  });
  els.groupFilter.addEventListener('change', renderTable);

  els.clearFiltersBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.accountFilter.value = '';
    els.categoryFilter.value = '';
    els.subcategoryFilter.value = '';
    els.groupFilter.value = '';
    refreshSubcategoryOptions();
    refreshGroupOptions();
    renderTable();
  });

  els.addItemBtn.addEventListener('click', () => openModal(null));
  els.modalCloseBtn.addEventListener('click', closeModal);
  els.cancelBtn.addEventListener('click', closeModal);
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  els.form.addEventListener('submit', handleFormSubmit);
  els.quantityInput.addEventListener('input', updateTotalPreview);
  els.priceInput.addEventListener('input', updateTotalPreview);

  els.itemTrigger.addEventListener('click', openPicker);
  els.pickerCloseBtn.addEventListener('click', closePicker);
  els.pickerOverlay.addEventListener('click', (e) => {
    if (e.target === els.pickerOverlay) closePicker();
  });
  els.pickerSearchInput.addEventListener('input', () => renderPickerResults(els.pickerSearchInput.value));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.pickerOverlay.hidden) {
      closePicker();
    } else if (!els.modalOverlay.hidden) {
      closeModal();
    }
  });

  els.exportBtn.addEventListener('click', exportData);
  els.importInput.addEventListener('change', () => {
    const file = els.importInput.files?.[0];
    if (file) importData(file);
    els.importInput.value = '';
  });
}

// ---------- Init ----------

function init(): void {
  populateStaticOptions();
  refreshSubcategoryOptions();
  refreshGroupOptions();
  attachEvents();
  render();
}

init();

import './style.css';
import { ITEM_CATALOG } from './items';
import type { Account, Item, StockEntry } from './types';

const ACCOUNTS: Account[] = ['notakxz', 'RepairKitMan', 'megagabriel10'];
const STORAGE_KEY = 'pd-manager-stock-v1';
const FAVORITES_KEY = 'pd-manager-favorites-v1';
const SETTINGS_KEY = 'pd-manager-settings-v1';
const FILTERS_KEY = 'pd-manager-filters-v1';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const PRICE_HISTORY_LIMIT = 20;

interface Settings {
  lowStockThreshold: number;
}
const DEFAULT_SETTINGS: Settings = { lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD };

const itemsById = new Map<string, Item>(ITEM_CATALOG.map((item) => [item.id, item]));

let stock: StockEntry[] = loadStock();
let favoriteItemIds: Set<string> = loadFavorites();
let lowStockThreshold: number = loadSettings().lowStockThreshold;

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

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch (err) {
    console.warn('Falha ao carregar favoritos:', err);
    return new Set();
  }
}

function saveFavorites(): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteItemIds]));
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const threshold = Number((parsed as Record<string, unknown> | null)?.lowStockThreshold);
    return {
      lowStockThreshold: Number.isFinite(threshold) && threshold >= 0 ? Math.round(threshold) : DEFAULT_SETTINGS.lowStockThreshold,
    };
  } catch (err) {
    console.warn('Falha ao carregar configurações:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lowStockThreshold }));
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

// ---------- Translations ----------
// The catalog's category/subcategory/group fields mirror the public/icons/ folder
// names (in English) so the generator script and item ids stay stable. This map
// only affects what's *displayed* — filtering still compares the original values.

const LABEL_PT: Record<string, string> = {
  // Categories
  Equipment: 'Equipamentos',
  Loot: 'Saque',
  Rations: 'Rações',
  Weapons: 'Armas',
  Wearables: 'Vestimentas',
  Geral: 'Geral',
  // Subcategories
  Components: 'Componentes',
  Electronics: 'Eletrônicos',
  Materials: 'Materiais',
  Tools: 'Ferramentas',
  Valuables: 'Valores',
  Drinks: 'Bebidas',
  Food: 'Comida',
  Parts: 'Peças',
  Primary: 'Primárias',
  Secondary: 'Secundárias',
  Throwables: 'Arremessáveis',
  Backpacks: 'Mochilas',
  'Chest Rigs': 'Coletes',
  Gloves: 'Luvas',
  Helmets: 'Capacetes',
  'Leg Armor': 'Proteção de pernas',
  Masks: 'Máscaras',
  Pants: 'Calças',
  Shirts: 'Camisas',
  Visors: 'Viseiras',
  // Groups (weapon parts)
  Extras: 'Extras',
  Front: 'Cano',
  Handles: 'Punhos',
  Magazines: 'Carregadores',
  Muzzle: 'Boca de cano',
  Optics: 'Ópticas',
  Stocks: 'Coronhas',
};

function translateLabel(label: string): string {
  return LABEL_PT[label] ?? label;
}

function sortByTranslatedLabel(values: string[]): string[] {
  return [...values].sort((a, b) => translateLabel(a).localeCompare(translateLabel(b), 'pt-BR'));
}

function itemBreadcrumb(item: Item): string {
  return [item.category, item.subcategory, item.group]
    .filter((part): part is string => Boolean(part))
    .map(translateLabel)
    .join(' • ');
}

/** Search haystack: name + breadcrumb in pt-BR + the original English category path,
 * so a search for either "Armas" or "Weapons" finds the same items. */
function itemSearchText(item: Item): string {
  const original = [item.category, item.subcategory, item.group].filter(Boolean).join(' ');
  return `${item.name} ${itemBreadcrumb(item)} ${original}`.toLowerCase();
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
  favoritesFilter: byId<HTMLInputElement>('favorites-filter'),
  lowStockFilter: byId<HTMLInputElement>('low-stock-filter'),
  clearFiltersBtn: byId<HTMLButtonElement>('clear-filters-btn'),
  addItemBtn: byId<HTMLButtonElement>('add-item-btn'),
  statsBtn: byId<HTMLButtonElement>('stats-btn'),
  lowStockThresholdInput: byId<HTMLInputElement>('low-stock-threshold-input'),
  accountTotalsList: byId<HTMLUListElement>('account-totals-list'),
  exportBtn: byId<HTMLButtonElement>('export-btn'),
  importInput: byId<HTMLInputElement>('import-input'),
  resultCount: byId<HTMLSpanElement>('result-count'),
  emptyState: byId<HTMLDivElement>('empty-state'),
  tableBody: byId<HTMLTableSectionElement>('stock-table-body'),
  selectAllCheckbox: byId<HTMLInputElement>('select-all-checkbox'),

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

  dialogOverlay: byId<HTMLDivElement>('dialog-overlay'),
  dialogMessage: byId<HTMLParagraphElement>('dialog-message'),
  dialogConfirmBtn: byId<HTMLButtonElement>('dialog-confirm-btn'),
  dialogCancelBtn: byId<HTMLButtonElement>('dialog-cancel-btn'),

  toastContainer: byId<HTMLDivElement>('toast-container'),

  statsOverlay: byId<HTMLDivElement>('stats-overlay'),
  statsCloseBtn: byId<HTMLButtonElement>('stats-close-btn'),
  statsBody: byId<HTMLDivElement>('stats-body'),

  historyOverlay: byId<HTMLDivElement>('history-overlay'),
  historyTitle: byId<HTMLHeadingElement>('history-title'),
  historyCloseBtn: byId<HTMLButtonElement>('history-close-btn'),
  historyBody: byId<HTMLDivElement>('history-body'),

  bulkBar: byId<HTMLDivElement>('bulk-bar'),
  bulkCount: byId<HTMLSpanElement>('bulk-count'),
  bulkAccountSelect: byId<HTMLSelectElement>('bulk-account-select'),
  bulkMoveBtn: byId<HTMLButtonElement>('bulk-move-btn'),
  bulkDeleteBtn: byId<HTMLButtonElement>('bulk-delete-btn'),
  bulkClearBtn: byId<HTMLButtonElement>('bulk-clear-btn'),
};

let selectedItemId: string | null = null;

// ---------- Sorting / filtering / selection state ----------

type SortColumn = 'name' | 'account' | 'quantity' | 'price' | 'total';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

let sortState: SortState = { column: null, direction: 'asc' };
let showOnlyFavorites = false;
let showOnlyLowStock = false;

/** In-memory bulk-selection (cleared on re-render of the underlying list/filters). */
const selectedEntryIds = new Set<string>();

/** Pending "undo remove" buffer: holds the removed entry + its original index so it can be restored. */
interface UndoBufferEntry {
  entry: StockEntry;
  index: number;
}
let undoBuffer: UndoBufferEntry | null = null;
let undoTimeoutId: number | undefined;

// ---------- Overlay scroll lock ----------
// Several overlays (form modal, item picker, confirm/alert dialog) can be
// stacked — e.g. a validation alert while the form modal is open — so we only
// release the body scroll lock once none of them remain visible.

function isAnyOverlayOpen(): boolean {
  return !els.modalOverlay.hidden
    || !els.pickerOverlay.hidden
    || !els.dialogOverlay.hidden
    || !els.statsOverlay.hidden
    || !els.historyOverlay.hidden;
}

function syncBodyScrollLock(): void {
  document.body.style.overflow = isAnyOverlayOpen() ? 'hidden' : '';
}

// ---------- Custom dialogs ----------
// Replaces window.confirm()/window.alert() — which render as plain
// browser-chrome popups ("localhost:5500 diz...") that clash with the themed
// UI — with an on-theme modal sharing the same panel/button language.

interface DialogOptions {
  confirmLabel?: string;
  /** Pass null to render an alert-style dialog with a single acknowledge button. */
  cancelLabel?: string | null;
  danger?: boolean;
}

function showDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  const { confirmLabel = 'OK', cancelLabel = 'Cancelar', danger = false } = options;

  return new Promise<boolean>((resolve) => {
    els.dialogMessage.textContent = message;
    els.dialogConfirmBtn.textContent = confirmLabel;
    els.dialogConfirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;

    const showCancel = cancelLabel !== null;
    els.dialogCancelBtn.hidden = !showCancel;
    if (showCancel) els.dialogCancelBtn.textContent = cancelLabel;

    const finish = (result: boolean) => {
      els.dialogOverlay.hidden = true;
      syncBodyScrollLock();
      els.dialogConfirmBtn.removeEventListener('click', onConfirm);
      els.dialogCancelBtn.removeEventListener('click', onCancel);
      els.dialogOverlay.removeEventListener('mousedown', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    };
    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === els.dialogOverlay) finish(false);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };

    els.dialogConfirmBtn.addEventListener('click', onConfirm);
    els.dialogCancelBtn.addEventListener('click', onCancel);
    els.dialogOverlay.addEventListener('mousedown', onBackdrop);
    document.addEventListener('keydown', onKeydown);

    els.dialogOverlay.hidden = false;
    syncBodyScrollLock();
    window.setTimeout(() => els.dialogConfirmBtn.focus(), 0);
  });
}

/** Styled stand-in for window.confirm() — resolves true/false instead of blocking. */
function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  return showDialog(message, options);
}

/** Styled stand-in for window.alert() — resolves once the user acknowledges. */
function alertDialog(message: string, options: Pick<DialogOptions, 'confirmLabel'> = {}): Promise<void> {
  return showDialog(message, { ...options, cancelLabel: null }).then(() => undefined);
}

// ---------- Toasts ----------
// Lightweight, non-blocking confirmations ("Item removido", "Exportado") that
// stack in a corner and disappear on their own — used instead of a dialog for
// feedback that doesn't need to interrupt the user, and to host the "Desfazer"
// (undo) action after removing entries.

interface ToastOptions {
  variant?: 'info' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

function showToast(message: string, options: ToastOptions = {}): void {
  const { variant = 'info', actionLabel, onAction, duration = 5000 } = options;

  const toast = document.createElement('div');
  toast.className = `toast${variant === 'info' ? '' : ` ${variant}`}`;

  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  toast.appendChild(messageEl);

  let timeoutId: number;
  const dismiss = () => {
    window.clearTimeout(timeoutId);
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  if (actionLabel && onAction) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    toast.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', dismiss);
  toast.appendChild(closeBtn);

  els.toastContainer.appendChild(toast);
  timeoutId = window.setTimeout(dismiss, duration);
}

// ---------- Filter option setup ----------

function populateStaticOptions(): void {
  for (const account of ACCOUNTS) {
    els.accountFilter.appendChild(new Option(account, account));
    els.accountSelect.appendChild(new Option(account, account));
    els.bulkAccountSelect.appendChild(new Option(account, account));
  }

  const categories = sortByTranslatedLabel([...new Set(ITEM_CATALOG.map((item) => item.category))]);
  for (const category of categories) {
    els.categoryFilter.appendChild(new Option(translateLabel(category), category));
  }
}

function refreshSubcategoryOptions(): void {
  const selectedCategory = els.categoryFilter.value;
  const current = els.subcategoryFilter.value;

  els.subcategoryFilter.innerHTML = '';
  els.subcategoryFilter.appendChild(new Option('Todas as subcategorias', ''));

  const subcats = sortByTranslatedLabel([...new Set(
    ITEM_CATALOG
      .filter((item) => (!selectedCategory || item.category === selectedCategory) && item.subcategory)
      .map((item) => item.subcategory as string)
  )]);

  for (const sub of subcats) {
    els.subcategoryFilter.appendChild(new Option(translateLabel(sub), sub));
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

  const groups = sortByTranslatedLabel([...new Set(
    ITEM_CATALOG
      .filter((item) => (!selectedCategory || item.category === selectedCategory)
        && (!selectedSubcategory || item.subcategory === selectedSubcategory)
        && item.group)
      .map((item) => item.group as string)
  )]);

  for (const group of groups) {
    els.groupFilter.appendChild(new Option(translateLabel(group), group));
  }

  els.groupFilter.disabled = groups.length === 0;
  if (groups.includes(current)) {
    els.groupFilter.value = current;
  }
}

// ---------- Filtering ----------

function isLowStock(entry: StockEntry): boolean {
  return lowStockThreshold > 0 && entry.quantity < lowStockThreshold;
}

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
    if (showOnlyFavorites && !favoriteItemIds.has(entry.itemId)) return false;
    if (showOnlyLowStock && !isLowStock(entry)) return false;
    if (query) {
      const haystack = `${itemSearchText(item)} ${entry.account}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

// ---------- Sorting ----------

function compareEntries(a: StockEntry, b: StockEntry): number {
  const itemA = itemsById.get(a.itemId)!;
  const itemB = itemsById.get(b.itemId)!;

  // Favorited items always float to the top, regardless of the active sort column.
  const favA = favoriteItemIds.has(a.itemId);
  const favB = favoriteItemIds.has(b.itemId);
  if (favA !== favB) return favA ? -1 : 1;

  const { column, direction } = sortState;
  const sign = direction === 'asc' ? 1 : -1;

  let primary = 0;
  switch (column) {
    case 'name':
      primary = itemA.name.localeCompare(itemB.name);
      break;
    case 'account':
      primary = a.account.localeCompare(b.account);
      break;
    case 'quantity':
      primary = a.quantity - b.quantity;
      break;
    case 'price':
      primary = a.price - b.price;
      break;
    case 'total':
      primary = entryTotal(a) - entryTotal(b);
      break;
    default:
      primary = 0;
  }

  if (primary !== 0) return primary * sign;

  // Stable secondary ordering so equal-valued rows don't jump around between renders.
  return itemA.name.localeCompare(itemB.name) || a.account.localeCompare(b.account);
}

function applySortIndicators(): void {
  const headers = els.tableBody.closest('table')?.querySelectorAll<HTMLTableCellElement>('th.sortable');
  headers?.forEach((th) => {
    const column = th.dataset.sort as SortColumn | undefined;
    const arrow = th.querySelector<HTMLElement>('.sort-arrow');
    if (column && column === sortState.column) {
      th.classList.add('sorted');
      th.setAttribute('aria-sort', sortState.direction === 'asc' ? 'ascending' : 'descending');
      if (arrow) arrow.textContent = sortState.direction === 'asc' ? '▲' : '▼';
    } else {
      th.classList.remove('sorted');
      th.removeAttribute('aria-sort');
      if (arrow) arrow.textContent = '';
    }
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

  // Drop selections that have fallen out of the current filter set.
  const filteredIds = new Set(filtered.map((entry) => entry.id));
  for (const id of [...selectedEntryIds]) {
    if (!filteredIds.has(id)) selectedEntryIds.delete(id);
  }

  if (stock.length === 0) {
    setEmptyState('Nenhum item no estoque ainda.');
    updateBulkBar(filtered);
    applySortIndicators();
    return;
  }

  if (filtered.length === 0) {
    setEmptyState('Nenhum item encontrado com os filtros atuais.');
    updateBulkBar(filtered);
    applySortIndicators();
    return;
  }

  els.emptyState.hidden = true;

  const sorted = [...filtered].sort(compareEntries);

  for (const entry of sorted) {
    els.tableBody.appendChild(buildRow(entry));
  }

  updateBulkBar(filtered);
  applySortIndicators();
}

function setEmptyState(message: string): void {
  els.emptyState.hidden = false;
  const p = els.emptyState.querySelector('p');
  if (p) p.textContent = message;
}

// ---------- Bulk selection ----------

function toggleEntrySelection(id: string, selected: boolean): void {
  if (selected) {
    selectedEntryIds.add(id);
  } else {
    selectedEntryIds.delete(id);
  }
  renderTable();
}

function clearSelection(): void {
  if (selectedEntryIds.size === 0) return;
  selectedEntryIds.clear();
  renderTable();
}

function toggleSelectAll(checked: boolean): void {
  const filtered = getFilteredEntries();
  if (checked) {
    for (const entry of filtered) selectedEntryIds.add(entry.id);
  } else {
    for (const entry of filtered) selectedEntryIds.delete(entry.id);
  }
  renderTable();
}

function updateBulkBar(filtered: StockEntry[]): void {
  const count = selectedEntryIds.size;
  els.bulkBar.hidden = count === 0;
  els.bulkCount.textContent = count === 1 ? '1 item selecionado' : `${count} itens selecionados`;

  const selectableCount = filtered.length;
  const selectedInView = filtered.filter((entry) => selectedEntryIds.has(entry.id)).length;
  els.selectAllCheckbox.checked = selectableCount > 0 && selectedInView === selectableCount;
  els.selectAllCheckbox.indeterminate = selectedInView > 0 && selectedInView < selectableCount;
  els.selectAllCheckbox.disabled = selectableCount === 0;
}

async function bulkMoveSelected(): Promise<void> {
  const targetAccount = els.bulkAccountSelect.value as Account | '';
  if (!targetAccount) {
    await alertDialog('Escolha uma conta de destino antes de mover.');
    return;
  }

  const ids = [...selectedEntryIds];
  if (ids.length === 0) return;

  let movedCount = 0;
  for (const id of ids) {
    const entry = stock.find((e) => e.id === id);
    if (!entry || entry.account === targetAccount) continue;
    entry.account = targetAccount;
    movedCount++;
  }

  if (movedCount === 0) {
    await alertDialog('Os itens selecionados já estão na conta escolhida.');
    return;
  }

  selectedEntryIds.clear();
  saveStock();
  els.bulkAccountSelect.value = '';
  showToast(`${movedCount} ${movedCount === 1 ? 'item movido' : 'itens movidos'} para ${targetAccount}.`, { variant: 'success' });
  render();
}

async function bulkDeleteSelected(): Promise<void> {
  const ids = [...selectedEntryIds];
  if (ids.length === 0) return;

  const confirmed = await confirmDialog(
    ids.length === 1
      ? 'Remover o item selecionado do estoque?'
      : `Remover os ${ids.length} itens selecionados do estoque?`,
    { confirmLabel: 'Remover', danger: true },
  );
  if (!confirmed) return;

  stock = stock.filter((entry) => !ids.includes(entry.id));
  selectedEntryIds.clear();
  saveStock();
  showToast(ids.length === 1 ? 'Item removido.' : `${ids.length} itens removidos.`, { variant: 'success' });
  render();
}

function buildRow(entry: StockEntry): HTMLTableRowElement {
  const item = itemsById.get(entry.itemId)!;
  const tr = document.createElement('tr');
  const lowStock = isLowStock(entry);
  if (selectedEntryIds.has(entry.id)) tr.classList.add('selected');
  if (lowStock) tr.classList.add('low-stock');

  const selectTd = document.createElement('td');
  selectTd.className = 'col-select';
  const selectCheckbox = document.createElement('input');
  selectCheckbox.type = 'checkbox';
  selectCheckbox.className = 'row-checkbox';
  selectCheckbox.checked = selectedEntryIds.has(entry.id);
  selectCheckbox.setAttribute('aria-label', `Selecionar ${item.name} (${entry.account})`);
  selectCheckbox.addEventListener('change', () => toggleEntrySelection(entry.id, selectCheckbox.checked));
  selectTd.appendChild(selectCheckbox);

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

  const isFavorite = favoriteItemIds.has(entry.itemId);
  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = `fav-btn${isFavorite ? ' active' : ''}`;
  favBtn.textContent = isFavorite ? '★' : '☆';
  favBtn.setAttribute('aria-label', isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
  favBtn.setAttribute('aria-pressed', String(isFavorite));
  favBtn.addEventListener('click', () => toggleFavorite(entry.itemId));

  const meta = document.createElement('span');
  meta.className = 'meta';
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = item.name;
  const pathSpan = document.createElement('span');
  pathSpan.className = 'path';
  pathSpan.textContent = itemBreadcrumb(item);
  meta.append(nameStrong, pathSpan);

  nameWrap.append(favBtn, meta);
  nameTd.appendChild(nameWrap);

  const accountTd = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'account-badge';
  badge.dataset.account = entry.account;
  badge.textContent = entry.account;
  accountTd.appendChild(badge);

  const qtyTd = document.createElement('td');
  qtyTd.className = 'col-num qty-cell';

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'qty-adjust-btn';
  minusBtn.textContent = '−';
  minusBtn.setAttribute('aria-label', 'Diminuir quantidade');
  minusBtn.disabled = entry.quantity <= 0;
  minusBtn.addEventListener('click', () => adjustQuantity(entry.id, -1));

  const qtyValue = document.createElement('span');
  qtyValue.className = 'qty-value';
  qtyValue.textContent = formatNumber(entry.quantity);

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'qty-adjust-btn';
  plusBtn.textContent = '+';
  plusBtn.setAttribute('aria-label', 'Aumentar quantidade');
  plusBtn.addEventListener('click', () => adjustQuantity(entry.id, 1));

  qtyTd.append(minusBtn, qtyValue, plusBtn);

  if (lowStock) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'low-stock-badge';
    badgeEl.textContent = 'Estoque baixo';
    qtyTd.appendChild(badgeEl);
  }

  const priceTd = document.createElement('td');
  priceTd.className = 'col-num price-cell';
  priceTd.textContent = formatRubles(entry.price);
  priceTd.setAttribute('role', 'button');
  priceTd.setAttribute('tabindex', '0');
  priceTd.title = 'Ver histórico de preço';
  priceTd.addEventListener('click', () => openHistoryPopover(entry));
  priceTd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openHistoryPopover(entry);
    }
  });

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

  const duplicateBtn = document.createElement('button');
  duplicateBtn.className = 'btn btn-secondary btn-small';
  duplicateBtn.type = 'button';
  duplicateBtn.textContent = 'Duplicar';
  duplicateBtn.style.marginLeft = '8px';
  duplicateBtn.addEventListener('click', () => duplicateEntry(entry));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger btn-small';
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Remover';
  deleteBtn.style.marginLeft = '8px';
  deleteBtn.addEventListener('click', () => deleteEntry(entry.id));

  actionsTd.append(editBtn, duplicateBtn, deleteBtn);

  tr.append(selectTd, iconTd, nameTd, accountTd, qtyTd, priceTd, totalTd, actionsTd);
  return tr;
}

function adjustQuantity(id: string, delta: number): void {
  const entry = stock.find((e) => e.id === id);
  if (!entry) return;
  const next = entry.quantity + delta;
  if (next < 0) return;
  entry.quantity = next;
  saveStock();
  render();
}

function toggleFavorite(itemId: string): void {
  if (favoriteItemIds.has(itemId)) {
    favoriteItemIds.delete(itemId);
  } else {
    favoriteItemIds.add(itemId);
  }
  saveFavorites();
  render();
}

function duplicateEntry(entry: StockEntry): void {
  openModal(null, {
    itemId: entry.itemId,
    account: entry.account,
    quantity: entry.quantity,
    price: entry.price,
  });
}

/** Removes an entry immediately and offers a time-limited "Desfazer" (undo) toast,
 *  replacing the old confirm-before-delete flow with a faster, reversible action. */
function deleteEntry(id: string): void {
  const index = stock.findIndex((e) => e.id === id);
  if (index === -1) return;
  const [entry] = stock.splice(index, 1);

  // Only one pending removal can be undone at a time — finalize any earlier one first.
  if (undoBuffer) {
    window.clearTimeout(undoTimeoutId);
    undoBuffer = null;
  }
  undoBuffer = { entry, index };

  selectedEntryIds.delete(id);
  saveStock();
  render();

  const item = itemsById.get(entry.itemId);
  const label = item ? item.name : 'Item';

  showToast(`${label} removido do estoque.`, {
    variant: 'info',
    actionLabel: 'Desfazer',
    duration: 6000,
    onAction: () => {
      if (!undoBuffer || undoBuffer.entry.id !== id) return;
      const restoreIndex = Math.min(undoBuffer.index, stock.length);
      stock.splice(restoreIndex, 0, undoBuffer.entry);
      undoBuffer = null;
      window.clearTimeout(undoTimeoutId);
      saveStock();
      render();
      showToast(`${label} restaurado.`, { variant: 'success' });
    },
  });

  undoTimeoutId = window.setTimeout(() => {
    if (undoBuffer && undoBuffer.entry.id === id) undoBuffer = null;
  }, 6000);
}

// ---------- Stock form modal ----------

/** Pre-fill values for a brand-new entry — used by "Duplicar" to seed the
 *  add-modal with another entry's item/account/quantity/price while still
 *  creating a separate entry on save (entryIdInput stays empty). */
interface EntryPrefill {
  itemId: string;
  account: Account;
  quantity: number;
  price: number;
}

function openModal(entry: StockEntry | null, prefill: EntryPrefill | null = null): void {
  els.form.reset();
  clearSelectedItem();

  if (entry) {
    els.modalTitle.textContent = 'Editar item do estoque';
    els.entryIdInput.value = entry.id;
    selectItem(entry.itemId);
    els.accountSelect.value = entry.account;
    els.quantityInput.value = String(entry.quantity);
    els.priceInput.value = String(entry.price);
  } else if (prefill) {
    els.modalTitle.textContent = 'Adicionar item ao estoque';
    els.entryIdInput.value = '';
    selectItem(prefill.itemId);
    els.accountSelect.value = prefill.account;
    els.quantityInput.value = String(prefill.quantity);
    els.priceInput.value = String(prefill.price);
  } else {
    els.modalTitle.textContent = 'Adicionar item ao estoque';
    els.entryIdInput.value = '';
    els.accountSelect.value = '';
    els.quantityInput.value = '';
    els.priceInput.value = '';
  }

  updateTotalPreview();
  els.modalOverlay.hidden = false;
  syncBodyScrollLock();
}

function closeModal(): void {
  els.modalOverlay.hidden = true;
  syncBodyScrollLock();
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

async function handleFormSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const itemId = els.selectedItemIdInput.value;
  const account = els.accountSelect.value as Account;
  const quantity = Math.round(Number(els.quantityInput.value));
  const price = Math.round(Number(els.priceInput.value));

  if (!itemId || !itemsById.has(itemId)) {
    await alertDialog('Selecione um item válido.');
    return;
  }
  if (!account) {
    await alertDialog('Selecione a conta.');
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    await alertDialog('Informe uma quantidade válida.');
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    await alertDialog('Informe um preço válido (Rubles são valores inteiros).');
    return;
  }

  const existingId = els.entryIdInput.value;

  if (existingId) {
    const entry = stock.find((e) => e.id === existingId);
    if (entry) {
      entry.itemId = itemId;
      entry.account = account;
      entry.quantity = quantity;
      if (price !== entry.price) recordPriceChange(entry, price);
      entry.price = price;
    }
  } else {
    const entry: StockEntry = { id: makeId(), itemId, account, quantity, price };
    recordPriceChange(entry, price);
    stock.push(entry);
  }

  saveStock();
  closeModal();
  render();
}

/** Appends a snapshot to the entry's price log (oldest first), capped to
 *  PRICE_HISTORY_LIMIT entries so the array can't grow unbounded over time. */
function recordPriceChange(entry: StockEntry, price: number): void {
  const history = entry.priceHistory ?? (entry.priceHistory = []);
  history.push({ price, date: new Date().toISOString() });
  if (history.length > PRICE_HISTORY_LIMIT) {
    history.splice(0, history.length - PRICE_HISTORY_LIMIT);
  }
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
  syncBodyScrollLock();
  window.setTimeout(() => els.pickerSearchInput.focus(), 0);
}

function closePicker(): void {
  els.pickerOverlay.hidden = true;
  syncBodyScrollLock();
}

function renderPickerResults(query: string): void {
  const trimmed = query.trim().toLowerCase();
  const items = trimmed
    ? ITEM_CATALOG.filter((item) => itemSearchText(item).includes(trimmed))
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

// ---------- Price history popover ----------

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function openHistoryPopover(entry: StockEntry): void {
  const item = itemsById.get(entry.itemId);
  els.historyTitle.textContent = item ? `Histórico de preço — ${item.name}` : 'Histórico de preço';
  els.historyBody.innerHTML = '';

  const current = document.createElement('div');
  current.className = 'history-current';
  const currentLabel = document.createElement('span');
  currentLabel.textContent = 'Preço atual';
  const currentValue = document.createElement('span');
  currentValue.className = 'value';
  currentValue.textContent = formatRubles(entry.price);
  current.append(currentLabel, currentValue);
  els.historyBody.appendChild(current);

  const history = entry.priceHistory ?? [];

  if (history.length <= 1) {
    const empty = document.createElement('p');
    empty.className = 'stats-empty';
    empty.textContent = 'Ainda não há mudanças de preço registradas para este item.';
    els.historyBody.appendChild(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'history-list';

    // Newest first, so the most recent change is easy to spot.
    const chronological = [...history];
    for (let i = chronological.length - 1; i >= 0; i--) {
      const point = chronological[i];
      const previous = chronological[i - 1];

      const li = document.createElement('li');

      const left = document.createElement('span');
      const dateSpan = document.createElement('span');
      dateSpan.className = 'date';
      dateSpan.textContent = formatHistoryDate(point.date);
      left.appendChild(dateSpan);

      const right = document.createElement('span');
      const priceSpan = document.createElement('span');
      priceSpan.textContent = formatRubles(point.price);
      right.appendChild(priceSpan);

      if (previous) {
        const trend = document.createElement('span');
        if (point.price > previous.price) {
          trend.className = 'history-trend up';
          trend.textContent = '▲';
        } else if (point.price < previous.price) {
          trend.className = 'history-trend down';
          trend.textContent = '▼';
        } else {
          trend.className = 'history-trend';
          trend.textContent = '—';
        }
        right.appendChild(trend);
      }

      li.append(left, right);
      list.appendChild(li);
    }

    els.historyBody.appendChild(list);
  }

  els.historyOverlay.hidden = false;
  syncBodyScrollLock();
}

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateTimeFormat.format(date);
}

function closeHistoryPopover(): void {
  els.historyOverlay.hidden = true;
  syncBodyScrollLock();
}

// ---------- Stats / insights panel ----------

function renderStats(): void {
  els.statsBody.innerHTML = '';

  if (stock.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'stats-empty';
    empty.textContent = 'Adicione itens ao estoque para ver estatísticas.';
    els.statsBody.appendChild(empty);
    return;
  }

  els.statsBody.append(
    buildTopItemsSection(),
    buildBarSection('Valor por categoria', aggregateByCategory()),
    buildBarSection('Valor por conta', aggregateByAccount()),
  );
}

interface AggregatedValue {
  label: string;
  value: number;
}

function aggregateByCategory(): AggregatedValue[] {
  const totals = new Map<string, number>();
  for (const entry of stock) {
    const item = itemsById.get(entry.itemId);
    if (!item) continue;
    const key = item.category;
    totals.set(key, (totals.get(key) ?? 0) + entryTotal(entry));
  }
  return [...totals.entries()]
    .map(([category, value]) => ({ label: translateLabel(category), value }))
    .sort((a, b) => b.value - a.value);
}

function aggregateByAccount(): AggregatedValue[] {
  const totals = new Map<string, number>();
  for (const entry of stock) {
    totals.set(entry.account, (totals.get(entry.account) ?? 0) + entryTotal(entry));
  }
  return [...totals.entries()]
    .map(([account, value]) => ({ label: account, value }))
    .sort((a, b) => b.value - a.value);
}

function buildBarSection(title: string, rows: AggregatedValue[]): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'stats-section';

  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'stats-empty';
    empty.textContent = 'Sem dados suficientes.';
    section.appendChild(empty);
    return section;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'stats-bar-row';

    const label = document.createElement('span');
    label.className = 'stats-label';
    label.textContent = row.label;
    label.title = row.label;

    const track = document.createElement('div');
    track.className = 'stats-bar-track';
    const fill = document.createElement('div');
    fill.className = 'stats-bar-fill';
    fill.style.width = `${Math.max(2, Math.round((row.value / max) * 100))}%`;
    track.appendChild(fill);

    const value = document.createElement('span');
    value.className = 'stats-value';
    value.textContent = formatRubles(row.value);

    rowEl.append(label, track, value);
    section.appendChild(rowEl);
  }

  return section;
}

function buildTopItemsSection(): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'stats-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Itens mais valiosos';
  section.appendChild(heading);

  const totalsByItem = new Map<string, number>();
  for (const entry of stock) {
    totalsByItem.set(entry.itemId, (totalsByItem.get(entry.itemId) ?? 0) + entryTotal(entry));
  }

  const top = [...totalsByItem.entries()]
    .map(([itemId, value]) => ({ item: itemsById.get(itemId), value }))
    .filter((row): row is { item: Item; value: number } => Boolean(row.item))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (top.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'stats-empty';
    empty.textContent = 'Sem dados suficientes.';
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'stats-top-list';

  top.forEach((row, index) => {
    const li = document.createElement('li');

    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `#${index + 1}`;

    const img = document.createElement('img');
    img.src = row.item.icon;
    img.alt = row.item.name;
    img.loading = 'lazy';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = row.item.name;
    name.title = row.item.name;

    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = formatRubles(row.value);

    li.append(rank, img, name, value);
    list.appendChild(li);
  });

  section.appendChild(list);
  return section;
}

function openStats(): void {
  renderStats();
  els.statsOverlay.hidden = false;
  syncBodyScrollLock();
}

function closeStats(): void {
  els.statsOverlay.hidden = true;
  syncBodyScrollLock();
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

async function importData(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : parsed.stock;
    if (!Array.isArray(incoming)) throw new Error('Formato inválido.');

    const validEntries = incoming.filter(isValidEntry);
    if (validEntries.length === 0) {
      await alertDialog('Nenhum item válido encontrado no arquivo.');
      return;
    }

    const itemWord = validEntries.length === 1 ? 'item válido' : 'itens válidos';
    const replace = await confirmDialog(
      `Encontrados ${validEntries.length} ${itemWord} no arquivo.\n\nComo deseja prosseguir?`,
      { confirmLabel: 'Substituir estoque atual', cancelLabel: 'Adicionar aos existentes' }
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
    await alertDialog('Importação concluída.');
  } catch (err) {
    console.error(err);
    await alertDialog('Não foi possível importar o arquivo. Verifique se é um JSON exportado pelo PD Manager.');
  }
}

// ---------- Persisted filters / sort / toggles ----------
// Remembers the sidebar filters, active sort column/direction and the
// favorites/low-stock toggles between sessions, so reloading the page
// restores the view exactly as the user left it.

const SORT_COLUMNS: SortColumn[] = ['name', 'account', 'quantity', 'price', 'total'];

interface PersistedFilters {
  search: string;
  account: string;
  category: string;
  subcategory: string;
  group: string;
  favoritesOnly: boolean;
  lowStockOnly: boolean;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
}

function saveFilters(): void {
  const state: PersistedFilters = {
    search: els.searchInput.value,
    account: els.accountFilter.value,
    category: els.categoryFilter.value,
    subcategory: els.subcategoryFilter.value,
    group: els.groupFilter.value,
    favoritesOnly: showOnlyFavorites,
    lowStockOnly: showOnlyLowStock,
    sortColumn: sortState.column,
    sortDirection: sortState.direction,
  };
  localStorage.setItem(FILTERS_KEY, JSON.stringify(state));
}

function loadFilters(): Partial<PersistedFilters> | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<PersistedFilters>;
  } catch (err) {
    console.warn('Falha ao carregar filtros salvos:', err);
    return null;
  }
}

/** Restores sidebar filters, sort state and toggles from localStorage.
 *  Must run after populateStaticOptions() (so <select> options exist) and
 *  before the first render(). */
function applyPersistedFilters(): void {
  const saved = loadFilters();
  if (!saved) return;

  if (typeof saved.search === 'string') els.searchInput.value = saved.search;
  if (typeof saved.account === 'string') els.accountFilter.value = saved.account;
  if (typeof saved.category === 'string') els.categoryFilter.value = saved.category;
  refreshSubcategoryOptions();
  if (typeof saved.subcategory === 'string') els.subcategoryFilter.value = saved.subcategory;
  refreshGroupOptions();
  if (typeof saved.group === 'string') els.groupFilter.value = saved.group;

  if (typeof saved.favoritesOnly === 'boolean') {
    showOnlyFavorites = saved.favoritesOnly;
    els.favoritesFilter.checked = showOnlyFavorites;
  }
  if (typeof saved.lowStockOnly === 'boolean') {
    showOnlyLowStock = saved.lowStockOnly;
    els.lowStockFilter.checked = showOnlyLowStock;
  }

  if (typeof saved.sortColumn === 'string' && (SORT_COLUMNS as string[]).includes(saved.sortColumn)) {
    sortState.column = saved.sortColumn as SortColumn;
  }
  if (saved.sortDirection === 'asc' || saved.sortDirection === 'desc') {
    sortState.direction = saved.sortDirection;
  }
}

// ---------- Wiring ----------

function attachEvents(): void {
  const persistFiltersAndRender = () => {
    saveFilters();
    renderTable();
  };

  els.searchInput.addEventListener('input', persistFiltersAndRender);
  els.accountFilter.addEventListener('change', persistFiltersAndRender);
  els.categoryFilter.addEventListener('change', () => {
    refreshSubcategoryOptions();
    refreshGroupOptions();
    persistFiltersAndRender();
  });
  els.subcategoryFilter.addEventListener('change', () => {
    refreshGroupOptions();
    persistFiltersAndRender();
  });
  els.groupFilter.addEventListener('change', persistFiltersAndRender);

  els.favoritesFilter.addEventListener('change', () => {
    showOnlyFavorites = els.favoritesFilter.checked;
    persistFiltersAndRender();
  });
  els.lowStockFilter.addEventListener('change', () => {
    showOnlyLowStock = els.lowStockFilter.checked;
    persistFiltersAndRender();
  });

  els.clearFiltersBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.accountFilter.value = '';
    els.categoryFilter.value = '';
    els.subcategoryFilter.value = '';
    els.groupFilter.value = '';
    els.favoritesFilter.checked = false;
    els.lowStockFilter.checked = false;
    showOnlyFavorites = false;
    showOnlyLowStock = false;
    refreshSubcategoryOptions();
    refreshGroupOptions();
    persistFiltersAndRender();
  });

  // Sortable column headers — clicking toggles asc/desc, switching columns resets to asc.
  els.tableBody.closest('table')?.querySelectorAll<HTMLTableCellElement>('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort as SortColumn | undefined;
      if (!column) return;
      if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.column = column;
        sortState.direction = 'asc';
      }
      saveFilters();
      renderTable();
    });
  });

  els.selectAllCheckbox.addEventListener('change', () => toggleSelectAll(els.selectAllCheckbox.checked));
  els.bulkMoveBtn.addEventListener('click', bulkMoveSelected);
  els.bulkDeleteBtn.addEventListener('click', bulkDeleteSelected);
  els.bulkClearBtn.addEventListener('click', clearSelection);

  els.lowStockThresholdInput.addEventListener('change', () => {
    const value = Math.round(Number(els.lowStockThresholdInput.value));
    lowStockThreshold = Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD;
    els.lowStockThresholdInput.value = String(lowStockThreshold);
    saveSettings();
    render();
  });

  els.statsBtn.addEventListener('click', openStats);
  els.statsCloseBtn.addEventListener('click', closeStats);
  els.statsOverlay.addEventListener('click', (e) => {
    if (e.target === els.statsOverlay) closeStats();
  });

  els.historyCloseBtn.addEventListener('click', closeHistoryPopover);
  els.historyOverlay.addEventListener('click', (e) => {
    if (e.target === els.historyOverlay) closeHistoryPopover();
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
    if (!els.dialogOverlay.hidden) return; // the dialog manages its own Escape handling
    if (!els.pickerOverlay.hidden) {
      closePicker();
    } else if (!els.historyOverlay.hidden) {
      closeHistoryPopover();
    } else if (!els.statsOverlay.hidden) {
      closeStats();
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
  els.lowStockThresholdInput.value = String(lowStockThreshold);
  refreshSubcategoryOptions();
  refreshGroupOptions();
  applyPersistedFilters();
  attachEvents();
  render();
}

init();

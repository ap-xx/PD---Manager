(function () {
  'use strict';

  const ACCOUNTS = ['notakxz', 'RepairKitMan', 'megagabriel10'];
  const STORAGE_KEY = 'pd-manager-stock-v1';

  const itemsById = new Map(ITEM_CATALOG.map((item) => [item.id, item]));

  /** @type {{id: string, itemId: string, account: string, quantity: number, price: number}[]} */
  let stock = loadStock();

  // Picker state
  let pickerSelectedId = null;
  let pickerActiveIndex = -1;
  let pickerResults = [];

  // ---------- Storage ----------

  function loadStock() {
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

  function isValidEntry(entry) {
    return entry
      && typeof entry.id === 'string'
      && typeof entry.itemId === 'string'
      && itemsById.has(entry.itemId)
      && typeof entry.account === 'string'
      && Number.isFinite(entry.quantity)
      && Number.isFinite(entry.price);
  }

  function saveStock() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
  }

  function makeId() {
    return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Formatting ----------

  const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const currencyFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function formatNumber(value) {
    return numberFormat.format(value);
  }

  function formatCurrency(value) {
    return currencyFormat.format(value);
  }

  function entryTotal(entry) {
    return entry.quantity * entry.price;
  }

  function itemBreadcrumb(item) {
    return [item.category, item.subcategory, item.group].filter(Boolean).join(' • ');
  }

  // ---------- DOM refs ----------

  const els = {
    summaryCards: document.getElementById('summary-cards'),
    searchInput: document.getElementById('search-input'),
    accountFilter: document.getElementById('account-filter'),
    categoryFilter: document.getElementById('category-filter'),
    subcategoryFilter: document.getElementById('subcategory-filter'),
    groupFilter: document.getElementById('group-filter'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    addItemBtn: document.getElementById('add-item-btn'),
    accountTotalsList: document.getElementById('account-totals-list'),
    exportBtn: document.getElementById('export-btn'),
    importInput: document.getElementById('import-input'),
    resultCount: document.getElementById('result-count'),
    emptyState: document.getElementById('empty-state'),
    tableBody: document.getElementById('stock-table-body'),

    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    form: document.getElementById('stock-form'),
    entryIdInput: document.getElementById('entry-id'),

    itemSearch: document.getElementById('item-search'),
    itemPickerResults: document.getElementById('item-picker-results'),
    itemPickerSelected: document.getElementById('item-picker-selected'),
    selectedItemIcon: document.getElementById('selected-item-icon'),
    selectedItemName: document.getElementById('selected-item-name'),
    selectedItemPath: document.getElementById('selected-item-path'),
    selectedItemIdInput: document.getElementById('selected-item-id'),
    changeItemBtn: document.getElementById('change-item-btn'),

    accountSelect: document.getElementById('account-select'),
    quantityInput: document.getElementById('quantity-input'),
    priceInput: document.getElementById('price-input'),
    totalPreviewValue: document.getElementById('total-preview-value'),
  };

  // ---------- Filter option setup ----------

  function populateStaticOptions() {
    for (const account of ACCOUNTS) {
      els.accountFilter.appendChild(new Option(account, account));
      els.accountSelect.appendChild(new Option(account, account));
    }

    const categories = [...new Set(ITEM_CATALOG.map((item) => item.category))].sort();
    for (const category of categories) {
      els.categoryFilter.appendChild(new Option(category, category));
    }
  }

  function refreshSubcategoryOptions() {
    const selectedCategory = els.categoryFilter.value;
    const current = els.subcategoryFilter.value;

    els.subcategoryFilter.innerHTML = '';
    els.subcategoryFilter.appendChild(new Option('Todas as subcategorias', ''));

    const subcats = [...new Set(
      ITEM_CATALOG
        .filter((item) => (!selectedCategory || item.category === selectedCategory) && item.subcategory)
        .map((item) => item.subcategory)
    )].sort();

    for (const sub of subcats) {
      els.subcategoryFilter.appendChild(new Option(sub, sub));
    }

    els.subcategoryFilter.disabled = subcats.length === 0;
    if (subcats.includes(current)) {
      els.subcategoryFilter.value = current;
    }
  }

  function refreshGroupOptions() {
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
        .map((item) => item.group)
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

  function getFilteredEntries() {
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
        const haystack = `${item.name} ${item.category} ${item.subcategory ?? ''} ${item.group ?? ''} ${entry.account}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  // ---------- Rendering ----------

  function render() {
    renderSummaryCards();
    renderAccountTotals();
    renderTable();
  }

  function renderSummaryCards() {
    const totalValue = stock.reduce((sum, entry) => sum + entryTotal(entry), 0);
    const totalQuantity = stock.reduce((sum, entry) => sum + entry.quantity, 0);
    const distinctItems = new Set(stock.map((entry) => entry.itemId)).size;

    els.summaryCards.innerHTML = '';
    els.summaryCards.appendChild(summaryCard('Valor total em estoque', formatCurrency(totalValue)));
    els.summaryCards.appendChild(summaryCard('Itens distintos', formatNumber(distinctItems)));
    els.summaryCards.appendChild(summaryCard('Quantidade total', formatNumber(totalQuantity)));
  }

  function summaryCard(label, value) {
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

  function renderAccountTotals() {
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
      value.textContent = formatCurrency(total);
      li.append(name, value);
      els.accountTotalsList.appendChild(li);
    }
  }

  function renderTable() {
    const filtered = getFilteredEntries();

    els.resultCount.textContent = stock.length
      ? `(${filtered.length} de ${stock.length} ${stock.length === 1 ? 'item' : 'itens'})`
      : '';

    els.tableBody.innerHTML = '';

    if (stock.length === 0) {
      els.emptyState.hidden = false;
      els.emptyState.querySelector('p').textContent = 'Nenhum item no estoque ainda.';
      return;
    }

    els.emptyState.hidden = filtered.length !== 0;
    if (filtered.length === 0) {
      els.emptyState.hidden = false;
      els.emptyState.querySelector('p').textContent = 'Nenhum item encontrado com os filtros atuais.';
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      const itemA = itemsById.get(a.itemId);
      const itemB = itemsById.get(b.itemId);
      return itemA.name.localeCompare(itemB.name) || a.account.localeCompare(b.account);
    });

    for (const entry of sorted) {
      els.tableBody.appendChild(buildRow(entry));
    }
  }

  function buildRow(entry) {
    const item = itemsById.get(entry.itemId);
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
    priceTd.textContent = formatCurrency(entry.price);

    const totalTd = document.createElement('td');
    totalTd.className = 'col-num row-total';
    totalTd.textContent = formatCurrency(entryTotal(entry));

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

  function deleteEntry(id) {
    const entry = stock.find((e) => e.id === id);
    if (!entry) return;
    const item = itemsById.get(entry.itemId);
    const label = item ? `${item.name} (${entry.account})` : entry.account;
    if (!window.confirm(`Remover "${label}" do estoque?`)) return;
    stock = stock.filter((e) => e.id !== id);
    saveStock();
    render();
  }

  // ---------- Modal / form ----------

  function openModal(entry) {
    els.form.reset();
    pickerSelectedId = null;
    pickerResults = [];
    pickerActiveIndex = -1;
    els.itemPickerResults.hidden = true;

    if (entry) {
      els.modalTitle.textContent = 'Editar item do estoque';
      els.entryIdInput.value = entry.id;
      selectItem(entry.itemId);
      els.accountSelect.value = entry.account;
      els.quantityInput.value = entry.quantity;
      els.priceInput.value = entry.price;
    } else {
      els.modalTitle.textContent = 'Adicionar item ao estoque';
      els.entryIdInput.value = '';
      clearSelectedItem();
      els.accountSelect.value = '';
      els.quantityInput.value = '';
      els.priceInput.value = '';
    }

    updateTotalPreview();
    els.modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      if (entry) {
        els.quantityInput.focus();
      } else {
        els.itemSearch.focus();
      }
    }, 0);
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function clearSelectedItem() {
    pickerSelectedId = null;
    els.selectedItemIdInput.value = '';
    els.itemPickerSelected.hidden = true;
    els.itemSearch.value = '';
    els.itemSearch.hidden = false;
  }

  function selectItem(itemId) {
    const item = itemsById.get(itemId);
    if (!item) return;
    pickerSelectedId = itemId;
    els.selectedItemIdInput.value = itemId;
    els.selectedItemIcon.src = item.icon;
    els.selectedItemIcon.alt = item.name;
    els.selectedItemName.textContent = item.name;
    els.selectedItemPath.textContent = itemBreadcrumb(item);
    els.itemPickerSelected.hidden = false;
    els.itemSearch.hidden = true;
    els.itemPickerResults.hidden = true;
  }

  function runItemSearch(query) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      pickerResults = ITEM_CATALOG.slice(0, 30);
    } else {
      pickerResults = ITEM_CATALOG
        .filter((item) => `${item.name} ${item.category} ${item.subcategory ?? ''} ${item.group ?? ''}`.toLowerCase().includes(trimmed))
        .slice(0, 30);
    }
    pickerActiveIndex = -1;
    renderItemPickerResults();
  }

  function renderItemPickerResults() {
    els.itemPickerResults.innerHTML = '';

    if (pickerResults.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nenhum item encontrado.';
      els.itemPickerResults.appendChild(empty);
      els.itemPickerResults.hidden = false;
      return;
    }

    pickerResults.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'item-picker-result' + (index === pickerActiveIndex ? ' active' : '');
      row.dataset.index = String(index);

      const img = document.createElement('img');
      img.src = item.icon;
      img.alt = '';
      img.loading = 'lazy';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const strong = document.createElement('strong');
      strong.textContent = item.name;
      const path = document.createElement('span');
      path.className = 'path';
      path.textContent = itemBreadcrumb(item);
      meta.append(strong, path);

      row.append(img, meta);
      row.addEventListener('mousedown', (e) => {
        // mousedown so it fires before the input blur hides the list
        e.preventDefault();
        selectItem(item.id);
      });

      els.itemPickerResults.appendChild(row);
    });

    els.itemPickerResults.hidden = false;
  }

  function moveActivePickerIndex(delta) {
    if (pickerResults.length === 0) return;
    pickerActiveIndex = (pickerActiveIndex + delta + pickerResults.length) % pickerResults.length;
    renderItemPickerResults();
    const activeEl = els.itemPickerResults.querySelector('.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function confirmActivePickerResult() {
    if (pickerActiveIndex >= 0 && pickerResults[pickerActiveIndex]) {
      selectItem(pickerResults[pickerActiveIndex].id);
    } else if (pickerResults.length === 1) {
      selectItem(pickerResults[0].id);
    }
  }

  function updateTotalPreview() {
    const quantity = Number(els.quantityInput.value) || 0;
    const price = Number(els.priceInput.value) || 0;
    els.totalPreviewValue.textContent = formatCurrency(quantity * price);
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const itemId = els.selectedItemIdInput.value;
    const account = els.accountSelect.value;
    const quantity = Number(els.quantityInput.value);
    const price = Number(els.priceInput.value);

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
      window.alert('Informe um preço válido.');
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

  // ---------- Export / Import ----------

  function exportData() {
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

  function importData(file) {
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
          `Encontrados ${validEntries.length} itens válidos.\n\n` +
          'Clique OK para SUBSTITUIR o estoque atual, ou Cancelar para ADICIONAR aos itens existentes.'
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

  function attachEvents() {
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modalOverlay.hidden) closeModal();
    });

    els.form.addEventListener('submit', handleFormSubmit);
    els.quantityInput.addEventListener('input', updateTotalPreview);
    els.priceInput.addEventListener('input', updateTotalPreview);

    els.changeItemBtn.addEventListener('click', () => {
      clearSelectedItem();
      runItemSearch('');
      els.itemSearch.focus();
    });

    els.itemSearch.addEventListener('focus', () => runItemSearch(els.itemSearch.value));
    els.itemSearch.addEventListener('input', () => runItemSearch(els.itemSearch.value));
    els.itemSearch.addEventListener('blur', () => {
      window.setTimeout(() => { els.itemPickerResults.hidden = true; }, 120);
    });
    els.itemSearch.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActivePickerIndex(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActivePickerIndex(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmActivePickerResult();
      } else if (e.key === 'Escape') {
        els.itemPickerResults.hidden = true;
      }
    });

    els.exportBtn.addEventListener('click', exportData);
    els.importInput.addEventListener('change', () => {
      const file = els.importInput.files && els.importInput.files[0];
      if (file) importData(file);
      els.importInput.value = '';
    });
  }

  // ---------- Init ----------

  function init() {
    populateStaticOptions();
    refreshSubcategoryOptions();
    refreshGroupOptions();
    attachEvents();
    render();
  }

  init();
})();

(function () {
  "use strict";
  let users = [];
  let items = [];
  let fornecedores = [];
  let movimentacoes = [];
  let sessao = null; // { userId }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "h" + hash.toString(36);
  }

  const loginScreen = document.getElementById("login-screen");
  const appEl = document.getElementById("app");
  const loginError = document.getElementById("login-error");

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");

  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    formLogin.style.display = "";
    formRegister.style.display = "none";
    hideLoginError();
  });
  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    formRegister.style.display = "";
    formLogin.style.display = "none";
    hideLoginError();
  });

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = "block";
  }
  function hideLoginError() {
    loginError.style.display = "none";
  }

  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const usuario = document.getElementById("login-user").value;
    const senha = document.getElementById("login-pass").value;
    const res = fazerLogin(usuario, senha);
    if (!res.ok) {
      showLoginError(res.msg);
      return;
    }
    hideLoginError();
    formLogin.reset();
    entrarNoApp();
  });

  formRegister.addEventListener("submit", (e) => {
    e.preventDefault();
    const usuario = document.getElementById("reg-user").value;
    const senha = document.getElementById("reg-pass").value;
    const res = criarUsuario(usuario, senha, "operador");
    if (!res.ok) {
      showLoginError(res.msg);
      return;
    }
    hideLoginError();
    formRegister.reset();
    sessao = { userId: res.user.id };
    toast(
      res.isFirstUser
        ? `Conta criada! Você é o administrador do sistema.`
        : "Conta criada com sucesso."
    );
    entrarNoApp();
  });

  document.getElementById("btn-logout").addEventListener("click", logout);

  function mostrarLogin() {
    loginScreen.style.display = "flex";
    appEl.style.display = "none";
  }

  function entrarNoApp() {
    const u = currentUser();
    if (!u) {
      mostrarLogin();
      return;
    }
    loginScreen.style.display = "none";
    appEl.style.display = "block";
    document.getElementById("user-name").textContent = u.user;
    document.getElementById("user-role").textContent =
      u.role === "admin" ? "Admin" : "Operador";
    document.getElementById("nav-usuarios").style.display =
      u.role === "admin" ? "" : "none";

    preencherSelectsFornecedor();
    preencherSelectMovItem();
    renderTudo();
  }

  /* =========================================================
     NAVEGAÇÃO ENTRE VIEWS
     ========================================================= */
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
    });
  });

  const formItem = document.getElementById("form-item");
  const tbodyEstoque = document.getElementById("tbody-estoque");
  const estoqueEmpty = document.getElementById("estoque-empty");
  const filtroBusca = document.getElementById("filtro-busca");
  const filtroStatus = document.getElementById("filtro-status");

  let ordenacao = { campo: null, dir: 1 };

  formItem.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("item-nome").value.trim();
    const categoria = document.getElementById("item-categoria").value.trim();
    const quantidade = Number(document.getElementById("item-qtd").value);
    const qtd_minima = Number(document.getElementById("item-min").value) || 0;
    const preco = Number(document.getElementById("item-preco").value);
    const fornecedorId = document.getElementById("item-fornecedor").value || null;

    if (!nome || quantidade < 0 || preco < 0) {
      toast("Preencha os campos corretamente.", true);
      return;
    }

    items.push({
      id: uid(),
      nome,
      categoria,
      quantidade,
      qtd_minima,
      preco,
      fornecedorId,
    });
    formItem.reset();
    document.getElementById("item-min").value = 5;
    toast("Item adicionado ao estoque.");
    preencherSelectMovItem();
    renderTudo();
  });

  filtroBusca.addEventListener("input", renderEstoque);
  filtroStatus.addEventListener("change", renderEstoque);

  document.querySelectorAll('#tabela-estoque th[data-sort]').forEach((th) => {
    th.addEventListener("click", () => {
      const campo = th.dataset.sort;
      if (ordenacao.campo === campo) {
        ordenacao.dir *= -1;
      } else {
        ordenacao.campo = campo;
        ordenacao.dir = 1;
      }
      renderEstoque();
    });
  });

  function itensFiltradosOrdenados() {
    let lista = items.slice();
    const busca = filtroBusca.value.trim().toLowerCase();
    const status = filtroStatus.value;

    if (busca) {
      lista = lista.filter((i) => i.nome.toLowerCase().includes(busca));
    }
    if (status) {
      lista = lista.filter((i) => statusItem(i) === status);
    }
    if (ordenacao.campo) {
      lista.sort((a, b) => {
        let va = a[ordenacao.campo];
        let vb = b[ordenacao.campo];
        if (typeof va === "string") {
          return va.localeCompare(vb) * ordenacao.dir;
        }
        return (va - vb) * ordenacao.dir;
      });
    }
    return lista;
  }

  function nomeFornecedor(id) {
    const f = fornecedores.find((f) => f.id === id);
    return f ? f.nome : "—";
  }

  function renderEstoque() {
    const lista = itensFiltradosOrdenados();
    tbodyEstoque.innerHTML = "";

    document.querySelectorAll('#tabela-estoque th[data-sort]').forEach((th) => {
      th.querySelector(".arrow")?.remove();
      if (th.dataset.sort === ordenacao.campo) {
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = ordenacao.dir === 1 ? "▲" : "▼";
        th.appendChild(arrow);
      }
    });

    estoqueEmpty.style.display = lista.length ? "none" : "block";

    lista.forEach((item) => {
      const s = statusItem(item);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="name" data-label="Nome">${escapeHtml(item.nome)}</td>
        <td data-label="Categoria">${escapeHtml(item.categoria || "—")}</td>
        <td data-label="Qtd.">${item.quantidade}</td>
        <td data-label="Mínima">${item.qtd_minima}</td>
        <td data-label="Preço">${brl(item.preco)}</td>
        <td data-label="Fornecedor">${escapeHtml(nomeFornecedor(item.fornecedorId))}</td>
        <td data-label="Status"><span class="stamp ${s}">${statusLabel(s)}</span></td>
        <td data-label="">
          <button class="icon-btn" data-action="editar-item" data-id="${item.id}">editar</button>
          ${isAdmin() ? `<button class="icon-btn danger" data-action="excluir-item" data-id="${item.id}">excluir</button>` : ""}
        </td>
      `;
      tbodyEstoque.appendChild(tr);
    });
  }

  tbodyEstoque.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "editar-item") abrirModalEditar(id);
    if (btn.dataset.action === "excluir-item") confirmarExclusao("item", id);
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  const modalEditar = document.getElementById("modal-editar");
  const formEditarItem = document.getElementById("form-editar-item");

  function abrirModalEditar(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    document.getElementById("edit-id").value = item.id;
    document.getElementById("edit-nome").value = item.nome;
    document.getElementById("edit-categoria").value = item.categoria || "";
    document.getElementById("edit-qtd").value = item.quantidade;
    document.getElementById("edit-min").value = item.qtd_minima;
    document.getElementById("edit-preco").value = item.preco;
    preencherSelectFornecedor(document.getElementById("edit-fornecedor"), item.fornecedorId);
    modalEditar.classList.add("active");
  }
  function fecharModalEditar() {
    modalEditar.classList.remove("active");
  }
  document.getElementById("modal-editar-fechar").addEventListener("click", fecharModalEditar);
  document.getElementById("modal-editar-cancelar").addEventListener("click", fecharModalEditar);

  formEditarItem.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    item.nome = document.getElementById("edit-nome").value.trim();
    item.categoria = document.getElementById("edit-categoria").value.trim();
    item.quantidade = Number(document.getElementById("edit-qtd").value);
    item.qtd_minima = Number(document.getElementById("edit-min").value) || 0;
    item.preco = Number(document.getElementById("edit-preco").value);
    item.fornecedorId = document.getElementById("edit-fornecedor").value || null;
    fecharModalEditar();
    toast("Item atualizado.");
    preencherSelectMovItem();
    renderTudo();
  });

  const modalConfirmar = document.getElementById("modal-confirmar");
  const modalConfirmarTexto = document.getElementById("modal-confirmar-texto");
  let exclusaoPendente = null;

  function confirmarExclusao(tipo, id) {
    if (!isAdmin()) {
      toast("Apenas administradores podem excluir registros.", true);
      return;
    }
    exclusaoPendente = { tipo, id };
    const textos = {
      item: "Tem certeza que deseja excluir este item do estoque?",
      fornecedor: "Tem certeza que deseja excluir este fornecedor?",
    };
    modalConfirmarTexto.textContent = textos[tipo] || "Confirma a exclusão?";
    modalConfirmar.classList.add("active");
  }
  function fecharModalConfirmar() {
    modalConfirmar.classList.remove("active");
    exclusaoPendente = null;
  }
  document.getElementById("modal-confirmar-fechar").addEventListener("click", fecharModalConfirmar);
  document.getElementById("modal-confirmar-cancelar").addEventListener("click", fecharModalConfirmar);
  document.getElementById("modal-confirmar-ok").addEventListener("click", () => {
    if (!exclusaoPendente) return;
    const { tipo, id } = exclusaoPendente;
    if (tipo === "item") {
      items = items.filter((i) => i.id !== id);
      toast("Item excluído.");
      preencherSelectMovItem();
    } else if (tipo === "fornecedor") {
      fornecedores = fornecedores.filter((f) => f.id !== id);
      items.forEach((i) => {
        if (i.fornecedorId === id) i.fornecedorId = null;
      });
      toast("Fornecedor excluído.");
      preencherSelectsFornecedor();
    }
    fecharModalConfirmar();
    renderTudo();
  });

  function toast(msg, isError) {
    const container = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function brl(n) {
    return (Number(n) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  function fmtData(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function statusItem(item) {
    if (item.quantidade <= 0) return "esgotado";
    if (item.quantidade <= item.qtd_minima) return "baixo";
    return "ok";
  }
  function statusLabel(s) {
    return s === "esgotado" ? "Esgotado" : s === "baixo" ? "Estoque baixo" : "Normal";
  }

  function currentUser() {
    if (!sessao) return null;
    return users.find((u) => u.id === sessao.userId) || null;
  }

  function isAdmin() {
    const u = currentUser();
    return !!u && u.role === "admin";
  }

  function fazerLogin(usuario, senha) {
    const u = users.find(
      (x) => x.user.toLowerCase() === usuario.trim().toLowerCase()
    );
    if (!u || u.pass !== simpleHash(senha)) {
      return { ok: false, msg: "Usuário ou senha inválidos." };
    }
    sessao = { userId: u.id };
    return { ok: true };
  }

  function criarUsuario(usuario, senha, role) {
    usuario = usuario.trim();
    if (usuario.length < 3) return { ok: false, msg: "Usuário deve ter ao menos 3 caracteres." };
    if (senha.length < 8) return { ok: false, msg: "Senha deve ter ao menos 8 caracteres." };
    if (users.some((u) => u.user.toLowerCase() === usuario.toLowerCase())) {
      return { ok: false, msg: "Esse usuário já existe." };
    }
    const isFirstUser = users.length === 0;
    const novo = {
      id: uid(),
      user: usuario,
      pass: simpleHash(senha),
      role: isFirstUser ? "admin" : role || "operador",
    };
    users.push(novo);
    return { ok: true, user: novo, isFirstUser };
  }

  function logout() {
    sessao = null;
    mostrarLogin();
  }

  const formMov = document.getElementById("form-mov");
  const selectMovItem = document.getElementById("mov-item");
  const tbodyMov = document.getElementById("tbody-mov");
  const movEmpty = document.getElementById("mov-empty");

  function preencherSelectMovItem() {
    const atual = selectMovItem.value;
    selectMovItem.innerHTML = "";
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.nome} (${item.quantidade} em estoque)`;
      selectMovItem.appendChild(opt);
    });
    if (atual) selectMovItem.value = atual;
  }

  formMov.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = selectMovItem.value;
    const tipo = document.getElementById("mov-tipo").value;
    const qtd = Number(document.getElementById("mov-qtd").value);
    const motivo = document.getElementById("mov-motivo").value.trim();

    const item = items.find((i) => i.id === itemId);
    if (!item) {
      toast("Cadastre um item antes de registrar movimentações.", true);
      return;
    }
    if (qtd <= 0) {
      toast("Informe uma quantidade válida.", true);
      return;
    }
    if (tipo === "saida" && qtd > item.quantidade) {
      toast("Quantidade insuficiente em estoque para essa saída.", true);
      return;
    }

    item.quantidade += tipo === "entrada" ? qtd : -qtd;

    movimentacoes.unshift({
      id: uid(),
      itemId,
      itemNome: item.nome,
      tipo,
      qtd,
      motivo,
      usuario: currentUser()?.user || "—",
      data: new Date().toISOString(),
    });

    formMov.reset();
    toast("Movimentação registrada.");
    preencherSelectMovItem();
    renderTudo();
  });

  function renderMovimentacoes() {
    tbodyMov.innerHTML = "";
    movEmpty.style.display = movimentacoes.length ? "none" : "block";
    movimentacoes.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Data">${fmtData(m.data)}</td>
        <td data-label="Item">${escapeHtml(m.itemNome)}</td>
        <td data-label="Tipo"><span class="tag-${m.tipo}">${m.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
        <td data-label="Qtd.">${m.qtd}</td>
        <td data-label="Motivo">${escapeHtml(m.motivo || "—")}</td>
        <td data-label="Usuário">${escapeHtml(m.usuario)}</td>
      `;
      tbodyMov.appendChild(tr);
    });
  }

  const formFornecedor = document.getElementById("form-fornecedor");
  const tbodyFornecedores = document.getElementById("tbody-fornecedores");
  const fornEmpty = document.getElementById("forn-empty");

  formFornecedor.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("forn-nome").value.trim();
    const contato = document.getElementById("forn-contato").value.trim();
    const cidade = document.getElementById("forn-cidade").value.trim();
    if (!nome) return;
    fornecedores.push({ id: uid(), nome, contato, cidade });
    formFornecedor.reset();
    toast("Fornecedor cadastrado.");
    preencherSelectsFornecedor();
    renderTudo();
  });

  function preencherSelectFornecedor(selectEl, selecionado) {
    selectEl.innerHTML = '<option value="">— nenhum —</option>';
    fornecedores.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.nome;
      selectEl.appendChild(opt);
    });
    if (selecionado) selectEl.value = selecionado;
  }
  function preencherSelectsFornecedor() {
    preencherSelectFornecedor(document.getElementById("item-fornecedor"));
    preencherSelectFornecedor(document.getElementById("edit-fornecedor"));
  }

  function renderFornecedores() {
    tbodyFornecedores.innerHTML = "";
    fornEmpty.style.display = fornecedores.length ? "none" : "block";
    fornecedores.forEach((f) => {
      const qtdItens = items.filter((i) => i.fornecedorId === f.id).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="name" data-label="Nome">${escapeHtml(f.nome)}</td>
        <td data-label="Contato">${escapeHtml(f.contato || "—")}</td>
        <td data-label="Cidade">${escapeHtml(f.cidade || "—")}</td>
        <td data-label="Itens fornecidos">${qtdItens}</td>
        <td data-label="">
          ${isAdmin() ? `<button class="icon-btn danger" data-action="excluir-fornecedor" data-id="${f.id}">excluir</button>` : ""}
        </td>
      `;
      tbodyFornecedores.appendChild(tr);
    });
  }

  tbodyFornecedores.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='excluir-fornecedor']");
    if (!btn) return;
    confirmarExclusao("fornecedor", btn.dataset.id);
  });

  const formUsuario = document.getElementById("form-usuario");

  formUsuario.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isAdmin()) {
      toast("Apenas administradores podem criar usuários.", true);
      return;
    }
    const usuario = document.getElementById("user-novo-nome").value;
    const senha = document.getElementById("user-novo-senha").value;
    const role = document.getElementById("user-novo-role").value;
    const res = criarUsuario(usuario, senha, role);
    if (!res.ok) {
      toast(res.msg, true);
      return;
    }
    formUsuario.reset();
    toast(`Usuário "${res.user.user}" criado como ${res.user.role}.`);
  });

  function renderDashboard() {
    const totalItens = items.length;
    const valorEstoque = items.reduce((acc, i) => acc + i.quantidade * i.preco, 0);
    const baixoOuEsgotado = items.filter((i) => statusItem(i) !== "ok").length;
    const movRecentes = movimentacoes.length;

    document.getElementById("kpi-itens").textContent = totalItens;
    document.getElementById("kpi-valor").textContent = brl(valorEstoque);
    document.getElementById("kpi-baixo").textContent = baixoOuEsgotado;
    document.getElementById("kpi-mov").textContent = movRecentes;

    const listaMov = document.getElementById("dash-mov-list");
    if (!movimentacoes.length) {
      listaMov.innerHTML = '<div class="empty">nenhuma movimentação registrada ainda</div>';
    } else {
      listaMov.innerHTML = movimentacoes
        .slice(0, 6)
        .map(
          (m) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;">
            <span>${escapeHtml(m.itemNome)} <span class="tag-${m.tipo}">(${m.tipo === "entrada" ? "+" : "-"}${m.qtd})</span></span>
            <span style="color:var(--muted);font-family:'JetBrains Mono',monospace;">${fmtData(m.data)}</span>
          </div>`
        )
        .join("");
    }

    const listaAlertas = document.getElementById("dash-alertas");
    const alertas = items.filter((i) => statusItem(i) !== "ok");
    if (!alertas.length) {
      listaAlertas.innerHTML = '<div class="empty">nenhum alerta de estoque no momento</div>';
    } else {
      listaAlertas.innerHTML = alertas
        .map((i) => {
          const s = statusItem(i);
          return `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;">
            <span>${escapeHtml(i.nome)}</span>
            <span class="stamp ${s}">${statusLabel(s)} · ${i.quantidade}/${i.qtd_minima}</span>
          </div>`;
        })
        .join("");
    }
  }

  document.getElementById("btn-export").addEventListener("click", () => {
    if (typeof XLSX === "undefined") {
      toast("Biblioteca de exportação não carregou.", true);
      return;
    }
    const wb = XLSX.utils.book_new();

    const wsItens = XLSX.utils.json_to_sheet(
      items.map((i) => ({
        Nome: i.nome,
        Categoria: i.categoria,
        Quantidade: i.quantidade,
        "Qtd. mínima": i.qtd_minima,
        "Preço unitário": i.preco,
        Fornecedor: nomeFornecedor(i.fornecedorId),
        Status: statusLabel(statusItem(i)),
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsItens, "Estoque");

    const wsMov = XLSX.utils.json_to_sheet(
      movimentacoes.map((m) => ({
        Data: fmtData(m.data),
        Item: m.itemNome,
        Tipo: m.tipo === "entrada" ? "Entrada" : "Saída",
        Quantidade: m.qtd,
        Motivo: m.motivo,
        Usuário: m.usuario,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMov, "Movimentações");

    const wsForn = XLSX.utils.json_to_sheet(
      fornecedores.map((f) => ({
        Nome: f.nome,
        Contato: f.contato,
        Cidade: f.cidade,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsForn, "Fornecedores");

    XLSX.writeFile(wb, "controle-estoque.xlsx");
    toast("Planilha exportada.");
  });

  function renderTudo() {
    renderEstoque();
    renderMovimentacoes();
    renderFornecedores();
    renderDashboard();
  }

  function init() {
    if (currentUser()) {
      entrarNoApp();
    } else {
      mostrarLogin();
    }
  }

  init();
})();

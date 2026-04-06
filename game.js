/* Lightweight formula-to-structure puzzle builder (not a full editor). */

(() => {
  const VALENCE_RULES = {
    H: [1],
    C: [4],
    N: [3],
    O: [2],
    F: [1],
    Cl: [1],
    Br: [1],
    I: [1],
    S: [2, 4, 6],
    P: [3, 5],
  };

  const ELEMENT_STYLES = {
    H: { fill: "#f3f4f6", stroke: "#cbd5e1", text: "#111827" },
    C: { fill: "#111827", stroke: "#0b1220", text: "#ffffff" },
    N: { fill: "#2563eb", stroke: "#1d4ed8", text: "#ffffff" },
    O: { fill: "#dc2626", stroke: "#b91c1c", text: "#ffffff" },
    Cl: { fill: "#16a34a", stroke: "#15803d", text: "#ffffff" },
    Br: { fill: "#a16207", stroke: "#854d0e", text: "#ffffff" },
    S: { fill: "#ca8a04", stroke: "#a16207", text: "#111827" },
    P: { fill: "#7c3aed", stroke: "#6d28d9", text: "#ffffff" },
  };

  const BOND_LABEL = { 1: "Single", 2: "Double", 3: "Triple" };

  /** @type {Array<{id:string, element:string, x:number, y:number}>} */
  let atoms = [];
  /** @type {Array<{id:string, a:string, b:string, order:1|2|3}>} */
  let bonds = [];

  let activeBondOrder = 1;
  let connectFromAtomId = null;
  let dragging = null; // {id, dx, dy}
  let bondDrag = null; // {fromId:string, pointerId:number, x1:number, y1:number}
  let activeTool = "bond"; // "bond" | "eraser"
  let erasing = null; // {pointerId:number, erased:Set<string>}

  const ui = {
    levelSelect: document.getElementById("levelSelect"),
    difficultySelect: document.getElementById("difficultySelect"),
    levelFormula: document.getElementById("levelFormula"),
    levelClue: document.getElementById("levelClue"),
    workspace: document.getElementById("workspace"),
    bondLayer: document.getElementById("bondLayer"),
    atomLayer: document.getElementById("atomLayer"),
    feedback: document.getElementById("feedback"),
    fact: document.getElementById("fact"),
    statusCounts: document.getElementById("statusCounts"),
    statusConn: document.getElementById("statusConn"),
    statusValence: document.getElementById("statusValence"),
    hudMode: document.getElementById("hudMode"),
    hudBond: document.getElementById("hudBond"),
    hudTip: document.getElementById("hudTip"),
    btnValidate: document.getElementById("btnValidate"),
    btnReset: document.getElementById("btnReset"),
    btnEraser: document.getElementById("btnEraser"),
    btnAnswer: document.getElementById("btnAnswer"),
    btnHint: document.getElementById("btnHint"),
    btnRing6: document.getElementById("btnRing6"),
    btnAromatic: document.getElementById("btnAromatic"),
    btnSnap: document.getElementById("btnSnap"),
  };
  const feedbackWrap = document.querySelector(".chem-feedback");

  const LEVELS = [
    {
      id: "ch4",
      formula: "CH4",
      name: "Methane",
      difficulty: "easy",
      allowedElements: ["C", "H"],
      hint: "One carbon with four single bonds to hydrogen.",
      fact: "Methane (CH₄) is the simplest alkane and a major component of natural gas.",
      mode: "beginner",
      targetStructures: [
        // Carbon connected to 4 hydrogens.
        makeStarTarget("C", "H", 4),
      ],
    },
    {
      id: "nh3",
      formula: "NH3",
      name: "Ammonia",
      difficulty: "easy",
      allowedElements: ["N", "H"],
      hint: "Nitrogen forms 3 single bonds here.",
      fact: "Ammonia (NH₃) is a key industrial chemical used to make fertilizers.",
      mode: "beginner",
      targetStructures: [makeStarTarget("N", "H", 3)],
    },
    {
      id: "h2o",
      formula: "H2O",
      name: "Water",
      difficulty: "easy",
      allowedElements: ["H", "O"],
      hint: "Oxygen forms two single bonds.",
      fact: "Water’s bent shape comes from lone pairs on oxygen (not shown here).",
      mode: "beginner",
      targetStructures: [makeTarget(["O", "H", "H"], [[0, 1, 1], [0, 2, 1]])],
    },
    {
      id: "co2",
      formula: "CO2",
      name: "Carbon dioxide",
      difficulty: "easy",
      allowedElements: ["C", "O"],
      hint: "O=C=O (two double bonds).",
      fact: "CO₂ is linear in its simplest Lewis structure representation.",
      mode: "beginner",
      targetStructures: [makeTarget(["O", "C", "O"], [[0, 1, 2], [1, 2, 2]])],
    },
    {
      id: "hcl",
      formula: "HCl",
      name: "Hydrogen chloride",
      difficulty: "easy",
      allowedElements: ["H", "Cl"],
      hint: "Just a single bond between H and Cl.",
      fact: "HCl in water forms hydrochloric acid.",
      mode: "beginner",
      targetStructures: [makeTarget(["H", "Cl"], [[0, 1, 1]])],
    },
    {
      id: "c2h4",
      formula: "C2H4",
      name: "Ethene",
      difficulty: "easy",
      allowedElements: ["C", "H"],
      hint: "Two carbons with a double bond between them.",
      fact: "Ethene (ethylene) is a major feedstock for plastics like polyethylene.",
      mode: "beginner",
      targetStructures: [makeEtheneTarget()],
    },
    {
      id: "c2h2",
      formula: "C2H2",
      name: "Ethyne",
      difficulty: "easy",
      allowedElements: ["C", "H"],
      hint: "Two carbons with a triple bond between them.",
      fact: "Ethyne (acetylene) has a C≡C triple bond and is used in welding torches.",
      mode: "beginner",
      targetStructures: [makeEthyneTarget()],
    },
    {
      id: "c2h6",
      formula: "C2H6",
      name: "Ethane",
      difficulty: "medium",
      allowedElements: ["C", "H"],
      hint: "Two carbons single-bonded; each carbon has three H.",
      fact: "Ethane is an alkane (single bonds only).",
      mode: "beginner",
      targetStructures: [makeEthaneTarget()],
    },
    {
      id: "ch3cl",
      formula: "CH3Cl",
      name: "Chloromethane",
      difficulty: "medium",
      allowedElements: ["C", "H", "Cl"],
      hint: "Methane with one H replaced by Cl.",
      fact: "Halogenated methanes are common starting points in synthesis.",
      mode: "beginner",
      targetStructures: [makeChloromethaneTarget()],
    },
    {
      id: "ch2o",
      formula: "CH2O",
      name: "Formaldehyde",
      difficulty: "medium",
      allowedElements: ["C", "H", "O"],
      hint: "H2C=O (a carbonyl).",
      fact: "Formaldehyde contains a carbonyl group (C=O).",
      mode: "beginner",
      targetStructures: [makeFormaldehydeTarget()],
    },
    {
      id: "c2h6o",
      formula: "C2H6O",
      name: "Two valid structures",
      difficulty: "medium",
      clue: "This formula has multiple valid structures. Any accepted isomer is OK.",
      allowedElements: ["C", "H", "O"],
      hint: "Try either an alcohol (C–C–O) or an ether (C–O–C).",
      fact: "C₂H₆O can be ethanol (an alcohol) or dimethyl ether (an ether). Same formula, different connectivity.",
      mode: "flexible",
      targetStructures: [makeEthanolTarget(), makeDimethylEtherTarget()],
    },
    {
      id: "c3h8",
      formula: "C3H8",
      name: "Propane",
      difficulty: "hard",
      allowedElements: ["C", "H"],
      hint: "A 3‑carbon chain with only single bonds.",
      fact: "Propane is a common fuel stored as a liquefied gas.",
      mode: "beginner",
      targetStructures: [makePropaneTarget()],
    },
    {
      id: "c3h6",
      formula: "C3H6",
      name: "Propene",
      difficulty: "hard",
      allowedElements: ["C", "H"],
      hint: "A 3‑carbon chain with one double bond.",
      fact: "Alkenes contain at least one C=C double bond.",
      mode: "beginner",
      targetStructures: [makePropeneTarget()],
    },
    {
      id: "c6h6",
      formula: "C6H6",
      name: "Benzene",
      difficulty: "hard",
      allowedElements: ["C", "H"],
      hint: "A 6‑member carbon ring with alternating double bonds.",
      fact: "Benzene is aromatic: the bonding is best described by resonance rather than fixed alternating double bonds.",
      mode: "beginner",
      targetStructures: [makeBenzeneTarget()],
    },
    {
      id: "c6h5cl",
      formula: "C6H5Cl",
      name: "Chlorobenzene",
      difficulty: "hard",
      allowedElements: ["C", "H", "Cl"],
      hint: "Benzene ring with one H replaced by Cl.",
      fact: "Chlorobenzene is used as a solvent and as an intermediate in chemical synthesis.",
      mode: "beginner",
      targetStructures: [makeChlorobenzeneTarget()],
    },
    {
      id: "c6h12",
      formula: "C6H12",
      name: "Cyclohexane",
      difficulty: "hardcore",
      allowedElements: ["C", "H"],
      hint: "A 6‑member ring with only single bonds; each carbon has two H.",
      fact: "Cyclohexane prefers non‑planar conformations (chair), not shown here.",
      mode: "beginner",
      targetStructures: [makeCyclohexaneTarget()],
    },
    {
      id: "c10h8",
      formula: "C10H8",
      name: "Naphthalene",
      difficulty: "hardcore",
      allowedElements: ["C", "H"],
      hint: "Two fused 6‑member rings (aromatic).",
      fact: "Naphthalene is a fused aromatic system (two rings share an edge).",
      mode: "beginner",
      targetStructures: [makeNaphthaleneTarget()],
    },
  ];

  let currentDifficulty = "easy";
  let currentLevelId = (LEVELS.find((l) => l.difficulty === currentDifficulty) || LEVELS[0]).id;
  let answerIndexByLevel = new Map();
  let answerShown = false;
  let savedAttempt = null; // {atoms:any[], bonds:any[], feedbackText:string, feedbackKind:string, factText:string, factHidden:boolean}

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function parseFormula(formula) {
    // Basic parser: element symbols (Capital + optional lowercase) followed by optional integer.
    // No parentheses support (intentionally).
    const counts = {};
    const re = /([A-Z][a-z]?)(\d*)/g;
    let m;
    while ((m = re.exec(formula)) !== null) {
      const el = m[1];
      const n = m[2] ? Number.parseInt(m[2], 10) : 1;
      counts[el] = (counts[el] || 0) + n;
    }
    return counts;
  }

  function atomCounts(list) {
    const c = {};
    for (const a of list) c[a.element] = (c[a.element] || 0) + 1;
    return c;
  }

  function formatCounts(counts) {
    const keys = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    if (!keys.length) return "—";
    return keys.map((k) => `${k}${counts[k]}`).join(" ");
  }

  function getLevel() {
    return LEVELS.find((l) => l.id === currentLevelId) || LEVELS[0];
  }

  function setFeedback(text, kind = "info") {
    ui.feedback.textContent = text;
    if (feedbackWrap) feedbackWrap.dataset.kind = kind;
  }

  function setFact(text) {
    if (!text) {
      ui.fact.hidden = true;
      ui.fact.textContent = "";
      return;
    }
    ui.fact.hidden = false;
    ui.fact.textContent = text;
  }

  function workspaceRect() {
    return ui.workspace.getBoundingClientRect();
  }

  function clampToWorkspace(x, y) {
    const r = workspaceRect();
    const pad = 22;
    return {
      x: Math.max(pad, Math.min(x, r.width - pad)),
      y: Math.max(pad, Math.min(y, r.height - pad)),
    };
  }

  function addAtom(element, x, y) {
    const id = uid("a");
    const p = clampToWorkspace(x, y);
    atoms.push({ id, element, x: p.x, y: p.y });
    connectFromAtomId = null;
    render();
    updateStatus();
    return id;
  }

  function removeAtom(atomId) {
    atoms = atoms.filter((a) => a.id !== atomId);
    bonds = bonds.filter((b) => b.a !== atomId && b.b !== atomId);
    if (connectFromAtomId === atomId) connectFromAtomId = null;
    render();
    updateStatus();
  }

  function getAtom(id) {
    return atoms.find((a) => a.id === id) || null;
  }

  function findBond(a, b) {
    return bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || null;
  }

  function removeBond(bondId) {
    bonds = bonds.filter((b) => b.id !== bondId);
    render();
    updateStatus();
  }

  function addOrUpdateBond(a, b, order) {
    if (a === b) return;
    const existing = findBond(a, b);
    if (!canApplyBondChange(a, b, order)) {
      setFeedback("That bond would exceed an atom’s allowed valence.", "bad");
      return;
    }
    if (existing) existing.order = order;
    else bonds.push({ id: uid("b"), a, b, order });
    render();
    updateStatus();
  }

  function cycleBondOrder(bond) {
    const cur = bond.order;
    for (let step = 1; step <= 3; step++) {
      const next = ((cur + step - 1) % 3) + 1; // 1..3
      if (canApplyBondChange(bond.a, bond.b, /** @type {1|2|3} */ (next), bond.id)) {
        bond.order = /** @type {1|2|3} */ (next);
        render();
        updateStatus();
        return;
      }
    }
    setFeedback("Can’t increase this bond without breaking valency.", "bad");
    render();
    updateStatus();
  }

  function setActiveBondOrder(n) {
    activeBondOrder = n;
    ui.hudBond.textContent = BOND_LABEL[n] || "Single";
    document.querySelectorAll(".chem-btn--seg").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.bond) === n);
    });
  }

  function bondSumFor(atomId) {
    let sum = 0;
    for (const b of bonds) {
      if (b.a === atomId || b.b === atomId) sum += b.order;
    }
    return sum;
  }

  function maxValenceFor(element) {
    const allowed = VALENCE_RULES[element] || [];
    if (!allowed.length) return Number.POSITIVE_INFINITY;
    return Math.max(...allowed);
  }

  function canApplyBondChange(aId, bId, nextOrder, existingBondId = null) {
    const a = getAtom(aId);
    const b = getAtom(bId);
    if (!a || !b) return false;
    const maxA = maxValenceFor(a.element);
    const maxB = maxValenceFor(b.element);
    const existing = existingBondId ? bonds.find((x) => x.id === existingBondId) : findBond(aId, bId);
    const oldOrder = existing ? existing.order : 0;
    const sumA = bondSumFor(aId) - oldOrder + nextOrder;
    const sumB = bondSumFor(bId) - oldOrder + nextOrder;
    return sumA <= maxA && sumB <= maxB;
  }

  function validateValency() {
    const errors = [];
    for (const a of atoms) {
      const allowed = VALENCE_RULES[a.element] || [];
      if (!allowed.length) continue;
      const sum = bondSumFor(a.id);
      const ok = allowed.some((v) => sum <= v);
      if (!ok) errors.push(`${a.element} has too many bonds.`);
    }
    return errors;
  }

  function connectivityStatus() {
    if (!atoms.length) return { ok: false, reason: "No atoms placed." };
    if (atoms.length === 1) return { ok: true, reason: "Single atom." };
    const adj = new Map();
    for (const a of atoms) adj.set(a.id, []);
    for (const b of bonds) {
      adj.get(b.a)?.push(b.b);
      adj.get(b.b)?.push(b.a);
    }
    const start = atoms[0].id;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop();
      for (const n of adj.get(cur) || []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    if (seen.size !== atoms.length) return { ok: false, reason: "Your structure is disconnected." };
    return { ok: true, reason: "Connected." };
  }

  function validateFormula(level) {
    const need = parseFormula(level.formula);
    const have = atomCounts(atoms);
    const elements = new Set([...Object.keys(need), ...Object.keys(have)]);
    for (const el of elements) {
      const nNeed = need[el] || 0;
      const nHave = have[el] || 0;
      if (nNeed !== nHave) {
        return {
          ok: false,
          reason: `You used the wrong number of ${prettyElement(el)} atoms.`,
          need,
          have,
        };
      }
    }
    return { ok: true, reason: "Counts match.", need, have };
  }

  function prettyElement(el) {
    const names = { H: "hydrogen", C: "carbon", O: "oxygen", N: "nitrogen", Cl: "chlorine", Br: "bromine", S: "sulfur", P: "phosphorus" };
    return names[el] || el;
  }

  function buildGraph() {
    // Node order is current atoms array order.
    const nodes = atoms.map((a) => ({ id: a.id, element: a.element }));
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    /** @type {number[][]} */
    const mat = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));
    for (const b of bonds) {
      const i = idx.get(b.a);
      const j = idx.get(b.b);
      if (i == null || j == null) continue;
      mat[i][j] = b.order;
      mat[j][i] = b.order;
    }
    return { nodes, mat };
  }

  function canonicalDegreeSignature(mat) {
    const deg = mat.map((row) => row.reduce((s, x) => s + x, 0));
    return deg;
  }

  function multiset(arr) {
    const m = new Map();
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
    return m;
  }

  function multisetEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a.entries()) if (b.get(k) !== v) return false;
    return true;
  }

  function isomorphicToTarget(current, target) {
    // target: {nodes:[{element}], mat:number[][]}
    if (current.nodes.length !== target.nodes.length) return false;

    const n = current.nodes.length;
    const curDeg = canonicalDegreeSignature(current.mat);
    const tgtDeg = canonicalDegreeSignature(target.mat);

    // candidate sets by element & degree
    const curByType = new Map();
    const tgtByType = new Map();
    for (let i = 0; i < n; i++) {
      const k1 = `${current.nodes[i].element}:${curDeg[i]}`;
      const k2 = `${target.nodes[i].element}:${tgtDeg[i]}`;
      if (!curByType.has(k1)) curByType.set(k1, []);
      if (!tgtByType.has(k2)) tgtByType.set(k2, []);
      curByType.get(k1).push(i);
      tgtByType.get(k2).push(i);
    }
    if (curByType.size !== tgtByType.size) return false;
    for (const [k, list] of curByType.entries()) {
      const other = tgtByType.get(k);
      if (!other || other.length !== list.length) return false;
    }

    // order nodes by constrainedness
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      const ka = `${current.nodes[a].element}:${curDeg[a]}`;
      const kb = `${current.nodes[b].element}:${curDeg[b]}`;
      const ca = curByType.get(ka)?.length ?? 1;
      const cb = curByType.get(kb)?.length ?? 1;
      return ca - cb;
    });

    const usedT = Array(n).fill(false);
    const mapCT = Array(n).fill(-1); // current index -> target index

    function compatiblePartial(ci, ti) {
      // Bond patterns to already mapped nodes must match.
      for (let cj = 0; cj < n; cj++) {
        const tj = mapCT[cj];
        if (tj === -1) continue;
        if (current.mat[ci][cj] !== target.mat[ti][tj]) return false;
      }
      return true;
    }

    function backtrack(pos) {
      if (pos === n) return true;
      const ci = order[pos];
      const key = `${current.nodes[ci].element}:${curDeg[ci]}`;
      const candidates = tgtByType.get(key) || [];
      for (const ti of candidates) {
        if (usedT[ti]) continue;
        if (!compatiblePartial(ci, ti)) continue;
        usedT[ti] = true;
        mapCT[ci] = ti;
        if (backtrack(pos + 1)) return true;
        mapCT[ci] = -1;
        usedT[ti] = false;
      }
      return false;
    }

    return backtrack(0);
  }

  function validateTarget(level) {
    const g = buildGraph();
    for (const t of level.targetStructures) {
      if (isomorphicToTarget(g, t)) return { ok: true };
    }
    return { ok: false };
  }

  function updateStatus() {
    const level = getLevel();
    const f = parseFormula(level.formula);
    const have = atomCounts(atoms);
    ui.statusCounts.textContent = `${formatCounts(have)} / need ${formatCounts(f)}`;

    const conn = connectivityStatus();
    ui.statusConn.textContent = conn.ok ? "Connected" : "Disconnected";
    ui.statusConn.dataset.ok = conn.ok ? "true" : "false";

    const valErr = validateValency();
    ui.statusValence.textContent = valErr.length ? "Invalid" : "OK";
    ui.statusValence.dataset.ok = valErr.length ? "false" : "true";
  }

  function render() {
    // Atoms
    ui.atomLayer.innerHTML = "";
    for (const a of atoms) {
      const el = document.createElement("div");
      el.className = "chem-node";
      el.dataset.id = a.id;
      el.dataset.element = a.element;
      el.style.left = `${a.x}px`;
      el.style.top = `${a.y}px`;
      const st = ELEMENT_STYLES[a.element] || { fill: "#111827", stroke: "#111827", text: "#fff" };
      el.style.setProperty("--node-fill", st.fill);
      el.style.setProperty("--node-stroke", st.stroke);
      el.style.setProperty("--node-text", st.text);
      // Default handle position (right edge) until hover updates it.
      el.style.setProperty("--hx", "100%");
      el.style.setProperty("--hy", "50%");
      el.innerHTML = `
        <span class="chem-node__sym">${a.element}</span>
        <span class="chem-node__handle" aria-hidden="true"></span>
      `;
      if (a.id === connectFromAtomId) el.classList.add("is-selected");
      ui.atomLayer.appendChild(el);
    }

    // Bonds (SVG)
    const r = workspaceRect();
    ui.bondLayer.setAttribute("viewBox", `0 0 ${Math.max(1, r.width)} ${Math.max(1, r.height)}`);
    ui.bondLayer.innerHTML = "";

    // Preview bond line (during handle-drag)
    if (bondDrag) {
      const prev = document.createElementNS("http://www.w3.org/2000/svg", "line");
      prev.setAttribute("id", "bondPreview");
      prev.setAttribute("class", "chem-bond__preview");
      prev.setAttribute("x1", "0");
      prev.setAttribute("y1", "0");
      prev.setAttribute("x2", "0");
      prev.setAttribute("y2", "0");
      ui.bondLayer.appendChild(prev);
    }
    for (const b of bonds) {
      const a1 = getAtom(b.a);
      const a2 = getAtom(b.b);
      if (!a1 || !a2) continue;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("chem-bond");
      g.dataset.id = b.id;
      g.dataset.order = String(b.order);

      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = 4.5;

      const lines = [];
      if (b.order === 1) {
        lines.push({ ox: 0, oy: 0 });
      } else if (b.order === 2) {
        lines.push({ ox: nx * offset, oy: ny * offset }, { ox: -nx * offset, oy: -ny * offset });
      } else {
        lines.push({ ox: 0, oy: 0 }, { ox: nx * offset * 1.4, oy: ny * offset * 1.4 }, { ox: -nx * offset * 1.4, oy: -ny * offset * 1.4 });
      }

      for (const ln of lines) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(a1.x + ln.ox));
        line.setAttribute("y1", String(a1.y + ln.oy));
        line.setAttribute("x2", String(a2.x + ln.ox));
        line.setAttribute("y2", String(a2.y + ln.oy));
        line.setAttribute("class", "chem-bond__line");
        g.appendChild(line);
      }

      // wider hit target
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hit.setAttribute("x1", String(a1.x));
      hit.setAttribute("y1", String(a1.y));
      hit.setAttribute("x2", String(a2.x));
      hit.setAttribute("y2", String(a2.y));
      hit.setAttribute("class", "chem-bond__hit");
      g.appendChild(hit);

      ui.bondLayer.appendChild(g);
    }
  }

  function resetWorkspace({ keepLevel = true } = {}) {
    atoms = [];
    bonds = [];
    connectFromAtomId = null;
    dragging = null;
    bondDrag = null;
    erasing = null;
    setFeedback("Build a structure that matches the formula, then submit.", "info");
    setFact("");
    render();
    updateStatus();
    if (!keepLevel) {
      currentLevelId = LEVELS[0].id;
      ui.levelSelect.value = currentLevelId;
    }
  }

  function loadLevel(id) {
    const level = LEVELS.find((l) => l.id === id) || LEVELS[0];
    currentLevelId = level.id;
    ui.levelSelect.value = level.id;
    ui.levelFormula.textContent = level.formula;
    ui.levelClue.textContent = level.clue || (level.name ? level.name : "");
    setFeedback("Build a structure that matches the formula, then submit.", "info");
    setFact("");
    answerShown = false;
    savedAttempt = null;
    if (ui.btnAnswer) {
      ui.btnAnswer.textContent = "Show answer";
      ui.btnAnswer.setAttribute("aria-pressed", "false");
    }
    resetWorkspace({ keepLevel: true });
  }

  function setMolecule(atomsIn, bondsIn) {
    atoms = atomsIn;
    bonds = bondsIn;
    connectFromAtomId = null;
    dragging = null;
    bondDrag = null;
    erasing = null;
    render();
    updateStatus();
  }

  function showAnswer() {
    const level = getLevel();
    const targets = level.targetStructures || [];
    if (!targets.length) {
      setFeedback("No answer available for this level.", "info");
      return;
    }
    if (answerShown) {
      // Hide answer -> restore saved attempt (if any)
      answerShown = false;
      if (ui.btnAnswer) {
        ui.btnAnswer.textContent = "Show answer";
        ui.btnAnswer.setAttribute("aria-pressed", "false");
      }
      if (savedAttempt) {
        setTool("bond");
        setMolecule(structuredClone(savedAttempt.atoms), structuredClone(savedAttempt.bonds));
        setFeedback(savedAttempt.feedbackText || "Build a structure that matches the formula, then submit.", savedAttempt.feedbackKind || "info");
        if (savedAttempt.factHidden) setFact("");
        else setFact(savedAttempt.factText || "");
      } else {
        setFeedback("Answer hidden.", "info");
      }
      return;
    }

    // Show answer -> snapshot current attempt so we can restore later
    savedAttempt = {
      atoms: structuredClone(atoms),
      bonds: structuredClone(bonds),
      feedbackText: ui.feedback?.textContent || "",
      feedbackKind: feedbackWrap?.dataset?.kind || "info",
      factText: ui.fact?.textContent || "",
      factHidden: !!ui.fact?.hidden,
    };
    answerShown = true;
    if (ui.btnAnswer) {
      ui.btnAnswer.textContent = "Hide answer";
      ui.btnAnswer.setAttribute("aria-pressed", "true");
    }

    const curIdx = answerIndexByLevel.get(level.id) ?? 0;
    const idx = curIdx % targets.length;
    answerIndexByLevel.set(level.id, idx + 1);
    const target = targets[idx];

    const r = workspaceRect();
    const cx = r.width * 0.58;
    const cy = r.height * 0.46;

    const positions = layoutForTarget(level.id, target, cx, cy);
    const newAtoms = target.nodes.map((n, i) => {
      const p = positions[i] || { x: cx + i * 22, y: cy };
      const clamped = clampToWorkspace(p.x, p.y);
      return { id: uid("a"), element: n.element, x: clamped.x, y: clamped.y };
    });

    const newBonds = [];
    for (let i = 0; i < target.mat.length; i++) {
      for (let j = i + 1; j < target.mat.length; j++) {
        const o = target.mat[i][j];
        if (!o) continue;
        newBonds.push({ id: uid("b"), a: newAtoms[i].id, b: newAtoms[j].id, order: /** @type {1|2|3} */ (o) });
      }
    }

    setTool("bond");
    setMolecule(newAtoms, newBonds);
    relaxLayout(80);
    setFeedback(targets.length > 1 ? `Answer shown (${idx + 1}/${targets.length}).` : "Answer shown.", "info");
    setFact("");
  }

  function layoutForTarget(levelId, target, cx, cy) {
    // Returns array of {x,y} aligned to the target node ordering.
    const n = target.nodes.length;
    const pts = [];
    const push = (x, y) => pts.push({ x, y });

    if (levelId === "ch4") {
      // C, H, H, H, H
      push(cx, cy);
      const rad = 86;
      for (let i = 0; i < 4; i++) {
        const ang = (Math.PI * 2 * i) / 4 - Math.PI / 2;
        push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      }
      return pts;
    }

    if (levelId === "nh3") {
      // N, H, H, H
      push(cx, cy);
      const rad = 86;
      for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      }
      return pts;
    }

    if (levelId === "h2o") {
      // O, H, H
      push(cx, cy);
      push(cx - 90, cy + 40);
      push(cx + 90, cy + 40);
      return pts;
    }

    if (levelId === "co2") {
      // O, C, O
      push(cx - 120, cy);
      push(cx, cy);
      push(cx + 120, cy);
      return pts;
    }

    if (levelId === "hcl") {
      push(cx - 70, cy);
      push(cx + 70, cy);
      return pts;
    }

    if (levelId === "c2h4") {
      // C, C, H, H, H, H (as in makeEtheneTarget)
      push(cx - 55, cy);
      push(cx + 55, cy);
      push(cx - 95, cy - 70);
      push(cx - 95, cy + 70);
      push(cx + 95, cy - 70);
      push(cx + 95, cy + 70);
      return pts;
    }

    if (levelId === "c2h2") {
      // C, C, H, H (as in makeEthyneTarget)
      push(cx - 60, cy);
      push(cx + 60, cy);
      push(cx - 120, cy);
      push(cx + 120, cy);
      return pts;
    }

    if (levelId === "c2h6") {
      // C, C, H... (makeEthaneTarget ordering)
      push(cx - 70, cy);
      push(cx + 70, cy);
      // 3 H around left carbon
      push(cx - 125, cy - 75);
      push(cx - 150, cy + 0);
      push(cx - 125, cy + 75);
      // 3 H around right carbon
      push(cx + 125, cy - 75);
      push(cx + 150, cy + 0);
      push(cx + 125, cy + 75);
      return pts;
    }

    if (levelId === "ch3cl") {
      // C, H, H, H, Cl
      push(cx, cy);
      push(cx - 100, cy - 65);
      push(cx - 110, cy + 25);
      push(cx - 55, cy + 95);
      push(cx + 120, cy);
      return pts;
    }

    if (levelId === "ch2o") {
      // C, O, H, H
      push(cx - 40, cy);
      push(cx + 115, cy);
      push(cx - 125, cy - 70);
      push(cx - 125, cy + 70);
      return pts;
    }

    if (levelId === "c2h6o") {
      // Distinguish ether vs alcohol by O degree in target graph.
      let oIndex = target.nodes.findIndex((x) => x.element === "O");
      const oDeg = oIndex >= 0 ? target.mat[oIndex].reduce((s, v) => s + (v ? 1 : 0), 0) : 0;
      if (oDeg === 2) {
        // Dimethyl ether-like: C - O - C
        push(cx - 110, cy); // C
        push(cx, cy); // O
        push(cx + 110, cy); // C
        // remaining 6 H as a halo
        const base = 3;
        for (let i = 0; i < 6; i++) {
          const host = i < 3 ? 0 : 2;
          const ang = (Math.PI * 2 * (i % 3)) / 3 - Math.PI / 2;
          const rad = 95;
          const hx = (host === 0 ? (cx - 110) : (cx + 110)) + Math.cos(ang) * rad;
          const hy = cy + Math.sin(ang) * rad;
          push(hx, hy);
        }
        return pts.slice(0, n);
      }
      // Ethanol-like: C - C - O (then Hs)
      push(cx - 150, cy); // C
      push(cx - 30, cy); // C
      push(cx + 100, cy); // O
      // 6 H distributed
      push(cx - 210, cy - 70);
      push(cx - 235, cy + 10);
      push(cx - 200, cy + 85);
      push(cx - 45, cy - 90);
      push(cx - 55, cy + 90);
      push(cx + 165, cy + 55); // OH hydrogen
      return pts;
    }

    if (levelId === "c3h8" || levelId === "c3h6") {
      // Propane/propene node orders match their target definitions.
      // Place 3 carbons in a row, hydrogens around each carbon.
      push(cx - 135, cy);
      push(cx, cy);
      push(cx + 135, cy);
      // remaining nodes are Hs; place them as a fan around the chain
      const start = 3;
      for (let i = start; i < n; i++) {
        const t = (i - start) / Math.max(1, n - start - 1);
        const x = cx - 180 + t * 360;
        const y = (i % 2 === 0) ? (cy - 95) : (cy + 95);
        push(x, y);
      }
      return pts.slice(0, n);
    }

    if (levelId === "c6h6" || levelId === "c6h5cl") {
      // Ring first 6 atoms (carbons), then substituents (H/Cl) in node order.
      const radC = 120;
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        push(cx + Math.cos(ang) * radC, cy + Math.sin(ang) * radC);
      }
      const radSub = 185;
      for (let i = 0; i < n - 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        push(cx + Math.cos(ang) * radSub, cy + Math.sin(ang) * radSub);
      }
      return pts;
    }

    if (levelId === "c6h12") {
      // Cyclohexane: ring + outward Hs (2 per carbon in our node ordering)
      const radC = 120;
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        push(cx + Math.cos(ang) * radC, cy + Math.sin(ang) * radC);
      }
      const radH = 190;
      for (let i = 0; i < 12; i++) {
        const cIdx = Math.floor(i / 2);
        const jitter = (i % 2 === 0) ? -0.14 : 0.14;
        const ang = (Math.PI * 2 * cIdx) / 6 - Math.PI / 2 + jitter;
        push(cx + Math.cos(ang) * radH, cy + Math.sin(ang) * radH);
      }
      return pts.slice(0, n);
    }

    if (levelId === "c10h8") {
      // Naphthalene: two fused hexagons sharing an edge. Our target node order: 10 C then 8 H.
      const rad = 105;
      const dx = 95; // fuse offset
      // left ring (C0..C5)
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        push(cx - dx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      }
      // right ring shares two carbons with left ring; but our node ordering is independent.
      // We'll place C6..C9 at the four non-shared positions of the right ring.
      const rightAngles = [ -Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2 ]; // top, upper-right, lower-right, bottom
      for (const ang of rightAngles) push(cx + dx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      // 8 H outward around the perimeter
      const radH = 175;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        push(cx + Math.cos(ang) * radH, cy + Math.sin(ang) * radH);
      }
      return pts.slice(0, n);
    }

    // Fallback: circle
    const rad = 120;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / Math.max(1, n);
      push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
    }
    return pts;
  }

  function relaxLayout(iterations = 60) {
    // A quick force pass to reduce overlap and crossings for "answer" layouts.
    // Not intended to be physically accurate—just readability.
    const ideal = 90;
    const repel = 1400;
    const dt = 0.018;
    const minDist = 52;

    for (let it = 0; it < iterations; it++) {
      const fx = new Map(atoms.map((a) => [a.id, 0]));
      const fy = new Map(atoms.map((a) => [a.id, 0]));

      // Repulsion (node-node)
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a = atoms[i];
          const b = atoms[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.001) d2 = 0.001;
          const d = Math.sqrt(d2);
          const push = (repel / d2) + (d < minDist ? 90 : 0);
          const ux = dx / d;
          const uy = dy / d;
          fx.set(a.id, fx.get(a.id) - ux * push);
          fy.set(a.id, fy.get(a.id) - uy * push);
          fx.set(b.id, fx.get(b.id) + ux * push);
          fy.set(b.id, fy.get(b.id) + uy * push);
        }
      }

      // Springs (bonds)
      for (const b of bonds) {
        const a1 = getAtom(b.a);
        const a2 = getAtom(b.b);
        if (!a1 || !a2) continue;
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = 0.9;
        const pull = (d - ideal) * k;
        const ux = dx / d;
        const uy = dy / d;
        fx.set(a1.id, fx.get(a1.id) + ux * pull);
        fy.set(a1.id, fy.get(a1.id) + uy * pull);
        fx.set(a2.id, fx.get(a2.id) - ux * pull);
        fy.set(a2.id, fy.get(a2.id) - uy * pull);
      }

      for (const a of atoms) {
        a.x += (fx.get(a.id) || 0) * dt;
        a.y += (fy.get(a.id) || 0) * dt;
        const p = clampToWorkspace(a.x, a.y);
        a.x = p.x;
        a.y = p.y;
      }
    }
    render();
    updateStatus();
  }

  function validateAll() {
    const level = getLevel();
    const f = validateFormula(level);
    if (!f.ok) {
      setFeedback(f.reason, "bad");
      return false;
    }

    const valErr = validateValency();
    if (valErr.length) {
      setFeedback(valErr[0] || "One atom has too many bonds.", "bad");
      return false;
    }

    const conn = connectivityStatus();
    if (!conn.ok) {
      setFeedback(conn.reason, "bad");
      return false;
    }

    const t = validateTarget(level);
    if (!t.ok) {
      if (level.mode === "flexible") {
        setFeedback("Correct formula, but the structure is not one of the accepted targets.", "bad");
      } else {
        setFeedback("Correct formula, but the structure is not the target compound.", "bad");
      }
      setFact("");
      return false;
    }

    setFeedback("Correct.", "good");
    setFact(level.fact || "");
    return true;
  }

  function snapLayout() {
    // Simple relaxation: aim for a readable bond length.
    const ideal = 82;
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      for (const b of bonds) {
        const a1 = getAtom(b.a);
        const a2 = getAtom(b.b);
        if (!a1 || !a2) continue;
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = (d - ideal) * 0.08;
        const ux = dx / d;
        const uy = dy / d;
        a1.x += ux * pull;
        a1.y += uy * pull;
        a2.x -= ux * pull;
        a2.y -= uy * pull;
      }
    }
    // Clamp all atoms inside workspace
    for (const a of atoms) {
      const p = clampToWorkspace(a.x, a.y);
      a.x = p.x;
      a.y = p.y;
    }
    render();
  }

  function makeRing6() {
    // Create six carbons in a hexagon and connect in a ring with single bonds.
    const r = workspaceRect();
    const cx = r.width * 0.55;
    const cy = r.height * 0.45;
    const rad = Math.min(r.width, r.height) * 0.22;
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      ids.push(addAtom("C", x, y));
    }
    for (let i = 0; i < 6; i++) {
      addOrUpdateBond(ids[i], ids[(i + 1) % 6], 1);
    }
    connectFromAtomId = null;
    render();
    updateStatus();
  }

  function alternateRingDoubles() {
    // If there is a 6-carbon ring, set alternating bond orders around it.
    // We detect the first cycle-like ring made by "Make 6-ring" layout: carbons with degree 2 within carbon-only subgraph.
    const carbonIds = atoms.filter((a) => a.element === "C").map((a) => a.id);
    if (carbonIds.length < 6) {
      setFeedback("Tip: Make a 6‑ring first (then alternate doubles).", "info");
      return;
    }
    // Find a ring of 6 where each has exactly 2 carbon neighbors.
    const carbonAdj = new Map();
    for (const id of carbonIds) carbonAdj.set(id, []);
    for (const b of bonds) {
      const a1 = getAtom(b.a);
      const a2 = getAtom(b.b);
      if (!a1 || !a2) continue;
      if (a1.element === "C" && a2.element === "C") {
        carbonAdj.get(a1.id)?.push(a2.id);
        carbonAdj.get(a2.id)?.push(a1.id);
      }
    }
    const ringCandidates = carbonIds.filter((id) => (carbonAdj.get(id) || []).length === 2);
    if (ringCandidates.length < 6) {
      setFeedback("Couldn’t find a clear 6‑carbon ring to aromatize.", "info");
      return;
    }
    // Walk a ring starting from first candidate.
    const start = ringCandidates[0];
    const ring = [start];
    let prev = null;
    let cur = start;
    for (let i = 0; i < 10; i++) {
      const nbrs = (carbonAdj.get(cur) || []).filter((x) => x !== prev);
      if (!nbrs.length) break;
      const next = nbrs[0];
      if (next === start) break;
      ring.push(next);
      prev = cur;
      cur = next;
      if (ring.length === 6) break;
    }
    if (ring.length !== 6) {
      setFeedback("Couldn’t isolate a 6‑member ring.", "info");
      return;
    }
    for (let i = 0; i < 6; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % 6];
      const order = (i % 2 === 0) ? 2 : 1;
      addOrUpdateBond(a, b, /** @type {1|2|3} */ (order));
    }
    setFeedback("Alternating double bonds applied.", "good");
  }

  function pointFromEvent(e) {
    const r = workspaceRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function edgePointForAtom(atomId, clientX, clientY) {
    const a = getAtom(atomId);
    if (!a) return null;
    const r = workspaceRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const dx = px - a.x;
    const dy = py - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const radius = 23; // matches .chem-node visual radius
    return { x: a.x + (dx / d) * radius, y: a.y + (dy / d) * radius, dist: d };
  }

  function isNearEdge(atomId, clientX, clientY) {
    const a = getAtom(atomId);
    if (!a) return false;
    const r = workspaceRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const dx = px - a.x;
    const dy = py - a.y;
    const d = Math.hypot(dx, dy);
    const radius = 23;
    const band = 8; // how thick the "edge zone" is
    return d >= radius - band && d <= radius + band;
  }

  function updateNodeHandle(nodeEl, atomId, clientX, clientY) {
    const p = edgePointForAtom(atomId, clientX, clientY);
    if (!p) return;
    // Convert to percentage for CSS positioning relative to the node box.
    // Node box is 46x46 with center at (23,23).
    const dx = p.x - getAtom(atomId).x;
    const dy = p.y - getAtom(atomId).y;
    const left = 23 + dx;
    const top = 23 + dy;
    nodeEl.style.setProperty("--hx", `${left}px`);
    nodeEl.style.setProperty("--hy", `${top}px`);
  }

  function updateBondPreview(clientX, clientY) {
    const line = ui.bondLayer.querySelector("#bondPreview");
    if (!line || !bondDrag) return;
    const r = workspaceRect();
    const x2 = clientX - r.left;
    const y2 = clientY - r.top;
    line.setAttribute("x1", String(bondDrag.x1));
    line.setAttribute("y1", String(bondDrag.y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
  }

  function startBondDrag(e, fromId, x1, y1) {
    e.preventDefault();
    if (activeTool === "eraser") return;
    ui.workspace.focus();
    bondDrag = { fromId, pointerId: e.pointerId, x1, y1 };
    connectFromAtomId = null;
    ui.hudMode.textContent = "Bond drag";
    ui.hudTip.textContent = "Drag to another atom to create a bond.";
    ui.workspace.setPointerCapture(e.pointerId);
    render();
    updateBondPreview(e.clientX, e.clientY);
  }

  function finishBondDrag(e) {
    if (!bondDrag) return;
    const fromId = bondDrag.fromId;
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Hit test: find the atom under the pointer.
    const el = document.elementFromPoint(clientX, clientY);
    const atomEl = el?.closest?.(".chem-node");
    const toId = atomEl?.dataset?.id;

    if (toId && toId !== fromId) {
      if (!canApplyBondChange(fromId, toId, /** @type {1|2|3} */ (activeBondOrder))) {
        setFeedback("Bond not allowed: would exceed valency.", "bad");
      } else {
        addOrUpdateBond(fromId, toId, /** @type {1|2|3} */ (activeBondOrder));
        setFeedback(`Bond created (${BOND_LABEL[activeBondOrder] || "Single"}).`, "good");
      }
    }

    bondDrag = null;
    ui.hudMode.textContent = "Connect";
    ui.hudTip.textContent = "Drag atoms. Use palette to add.";
    render();
    updateStatus();
  }

  function setTool(next) {
    activeTool = next;
    const on = activeTool === "eraser";
    ui.btnEraser?.classList.toggle("is-active", on);
    ui.btnEraser?.setAttribute("aria-pressed", on ? "true" : "false");
    ui.hudMode.textContent = on ? "Eraser" : "Connect";
    ui.hudTip.textContent = on ? "Scribble over atoms/bonds to erase." : "Drag atoms. Use palette to add.";
    connectFromAtomId = null;
    bondDrag = null;
    dragging = null;
    document.body.classList.toggle("is-eraser", on);
    ui.workspace.classList.toggle("is-eraser", on);
    render();
  }

  function eraseAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;

    const atomEl = el.closest?.(".chem-node");
    if (atomEl?.dataset?.id) {
      const key = `a:${atomEl.dataset.id}`;
      if (erasing && erasing.erased.has(key)) return;
      erasing?.erased.add(key);
      removeAtom(atomEl.dataset.id);
      return;
    }

    const bondEl = el.closest?.(".chem-bond");
    if (bondEl?.dataset?.id) {
      const key = `b:${bondEl.dataset.id}`;
      if (erasing && erasing.erased.has(key)) return;
      erasing?.erased.add(key);
      removeBond(bondEl.dataset.id);
    }
  }

  function onAtomPointerDown(e, atomId) {
    e.preventDefault();
    if (activeTool === "eraser") return;
    const a = getAtom(atomId);
    if (!a) return;
    ui.workspace.focus();
    const p = pointFromEvent(e);
    dragging = { id: atomId, dx: a.x - p.x, dy: a.y - p.y };
    ui.hudTip.textContent = "Release to place. Drag from the edge handle to bond.";
    ui.workspace.setPointerCapture(e.pointerId);
  }

  function onWorkspacePointerMove(e) {
    if (erasing) {
      eraseAt(e.clientX, e.clientY);
      return;
    }
    if (bondDrag) {
      updateBondPreview(e.clientX, e.clientY);
      return;
    }
    if (!dragging) return;
    const a = getAtom(dragging.id);
    if (!a) return;
    const p = pointFromEvent(e);
    const next = clampToWorkspace(p.x + dragging.dx, p.y + dragging.dy);
    a.x = next.x;
    a.y = next.y;
    render();
  }

  function onWorkspacePointerUp(e) {
    if (erasing) {
      erasing = null;
      ui.hudTip.textContent = "Scribble over atoms/bonds to erase.";
      updateStatus();
      return;
    }
    if (bondDrag) {
      finishBondDrag(e);
      return;
    }
    if (!dragging) return;
    dragging = null;
    ui.hudTip.textContent = "Drag atoms. Use palette to add.";
    updateStatus();
  }

  // Note: bonding is handled via the edge handle drag interaction.

  function onContextDelete(e) {
    const atomEl = e.target.closest(".chem-node");
    const bondEl = e.target.closest(".chem-bond");
    if (atomEl) {
      e.preventDefault();
      removeAtom(atomEl.dataset.id);
      return;
    }
    if (bondEl) {
      e.preventDefault();
      removeBond(bondEl.dataset.id);
    }
  }

  function initPalette() {
    document.querySelectorAll(".chem-atom").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = btn.dataset.element;
        const r = workspaceRect();
        const x = r.width * (0.55 + (Math.random() - 0.5) * 0.18);
        const y = r.height * (0.48 + (Math.random() - 0.5) * 0.18);
        addAtom(el, x, y);
      });
    });
  }

  function initBondTools() {
    document.querySelectorAll(".chem-btn--seg").forEach((btn) => {
      btn.addEventListener("click", () => setActiveBondOrder(Number(btn.dataset.bond)));
    });
    setActiveBondOrder(1);
  }

  function initWorkspaceEvents() {
    ui.atomLayer.addEventListener("pointerdown", (e) => {
      if (activeTool === "eraser") return;
      const el = e.target.closest(".chem-node");
      if (!el) return;
      const atomId = el.dataset.id;
      if (isNearEdge(atomId, e.clientX, e.clientY)) {
        const p = edgePointForAtom(atomId, e.clientX, e.clientY);
        if (!p) return;
        startBondDrag(e, atomId, p.x, p.y);
        return;
      }
      onAtomPointerDown(e, atomId);
    });
    ui.atomLayer.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".chem-node");
      if (!el) return;
      const atomId = el.dataset.id;
      updateNodeHandle(el, atomId, e.clientX, e.clientY);
    });
    ui.atomLayer.addEventListener("pointerleave", (e) => {
      const el = e.target.closest?.(".chem-node");
      if (!el) return;
      el.style.setProperty("--hx", "100%");
      el.style.setProperty("--hy", "50%");
    });
    ui.bondLayer.addEventListener("click", (e) => {
      const g = e.target.closest(".chem-bond");
      if (!g) return;
      const bond = bonds.find((b) => b.id === g.dataset.id);
      if (!bond) return;
      if (activeTool === "eraser") {
        removeBond(bond.id);
        setFeedback("Bond removed.", "good");
        return;
      }
      cycleBondOrder(bond);
    });

    ui.workspace.addEventListener("pointermove", onWorkspacePointerMove);
    ui.workspace.addEventListener("pointerup", onWorkspacePointerUp);
    ui.workspace.addEventListener("pointercancel", onWorkspacePointerUp);
    ui.workspace.addEventListener("contextmenu", onContextDelete);
    ui.workspace.addEventListener("pointerdown", (e) => {
      if (activeTool !== "eraser") return;
      e.preventDefault();
      ui.workspace.focus();
      erasing = { pointerId: e.pointerId, erased: new Set() };
      ui.workspace.setPointerCapture(e.pointerId);
      eraseAt(e.clientX, e.clientY);
    });
  }

  function initControls() {
    ui.btnReset.addEventListener("click", () => resetWorkspace({ keepLevel: true }));
    ui.btnValidate.addEventListener("click", () => validateAll());
    ui.btnEraser?.addEventListener("click", () => setTool(activeTool === "eraser" ? "bond" : "eraser"));
    ui.btnAnswer?.addEventListener("click", () => showAnswer());
    ui.btnHint.addEventListener("click", () => {
      const level = getLevel();
      setFeedback(level.hint || "Try building a valid structure for the formula.", "info");
    });
    ui.btnRing6.addEventListener("click", () => makeRing6());
    ui.btnAromatic.addEventListener("click", () => alternateRingDoubles());
    ui.btnSnap.addEventListener("click", () => snapLayout());
  }

  function setDifficulty(next) {
    currentDifficulty = next;
    initLevels();
    loadLevel(currentLevelId);
  }

  function initLevels() {
    const visible = LEVELS.filter((l) => (l.difficulty || "easy") === currentDifficulty);
    ui.levelSelect.innerHTML = "";
    for (const level of visible) {
      const opt = document.createElement("option");
      opt.value = level.id;
      opt.textContent = `${level.formula}${level.name ? ` — ${level.name}` : ""}`;
      ui.levelSelect.appendChild(opt);
    }
    ui.levelSelect.addEventListener("change", () => loadLevel(ui.levelSelect.value));

    // Ensure currentLevelId is in the filtered list
    if (!visible.some((l) => l.id === currentLevelId)) {
      currentLevelId = visible[0]?.id || LEVELS[0].id;
    }
    ui.levelSelect.value = currentLevelId;
  }

  function onResize() {
    render();
  }

  // ---- Targets (graph definitions) ----
  function makeTarget(nodes, edges) {
    // nodes: array of element symbols
    // edges: array of [i,j,order]
    const mat = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));
    for (const [i, j, o] of edges) {
      mat[i][j] = o;
      mat[j][i] = o;
    }
    return { nodes: nodes.map((e) => ({ element: e })), mat };
  }

  function makeStarTarget(centerEl, leafEl, leafCount) {
    const nodes = [centerEl, ...Array.from({ length: leafCount }, () => leafEl)];
    const edges = [];
    for (let i = 1; i <= leafCount; i++) edges.push([0, i, 1]);
    return makeTarget(nodes, edges);
  }

  function makeEtheneTarget() {
    // C=C with 2 H on each carbon.
    const nodes = ["C", "C", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 2],
      [0, 2, 1],
      [0, 3, 1],
      [1, 4, 1],
      [1, 5, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeEthyneTarget() {
    // H-C≡C-H
    const nodes = ["C", "C", "H", "H"];
    const edges = [
      [0, 1, 3],
      [0, 2, 1],
      [1, 3, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeEthaneTarget() {
    // H3C-CH3
    const nodes = ["C", "C", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
      [1, 5, 1],
      [1, 6, 1],
      [1, 7, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeChloromethaneTarget() {
    // CH3Cl
    const nodes = ["C", "H", "H", "H", "Cl"];
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeFormaldehydeTarget() {
    // H2C=O
    const nodes = ["C", "O", "H", "H"];
    const edges = [
      [0, 1, 2],
      [0, 2, 1],
      [0, 3, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makePropaneTarget() {
    // CH3-CH2-CH3
    const nodes = ["C", "C", "C", "H", "H", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      // H on C0 (3)
      [0, 3, 1],
      [0, 4, 1],
      [0, 5, 1],
      // H on C1 (2)
      [1, 6, 1],
      [1, 7, 1],
      // H on C2 (3)
      [2, 8, 1],
      [2, 9, 1],
      [2, 10, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makePropeneTarget() {
    // CH2=CH-CH3 (node order: C0 C1 C2, then Hs)
    const nodes = ["C", "C", "C", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 2],
      [1, 2, 1],
      // H on C0 (2)
      [0, 3, 1],
      [0, 4, 1],
      // H on C1 (1)
      [1, 5, 1],
      // H on C2 (3)
      [2, 6, 1],
      [2, 7, 1],
      [2, 8, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeCyclohexaneTarget() {
    // 6 C ring, all single bonds, each C has 2 H (total 12 H)
    const nodes = ["C", "C", "C", "C", "C", "C",
      "H","H","H","H","H","H","H","H","H","H","H","H"
    ];
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 1],
      [4, 5, 1],
      [5, 0, 1],
      // two H per carbon, in order
      [0, 6, 1],[0, 7, 1],
      [1, 8, 1],[1, 9, 1],
      [2,10, 1],[2,11, 1],
      [3,12, 1],[3,13, 1],
      [4,14, 1],[4,15, 1],
      [5,16, 1],[5,17, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeNaphthaleneTarget() {
    // Simple fused-ring target (Kekulé-like). Node order chosen for compact definition:
    // 10 carbons (0..9), 8 hydrogens (10..17)
    const nodes = ["C","C","C","C","C","C","C","C","C","C",
      "H","H","H","H","H","H","H","H"
    ];
    // Fused ring connectivity (two rings share bond between C4-C5)
    // Perimeter: 0-1-2-3-4-5-6-7-8-9-0, plus chord 4-5 is shared edge already in perimeter.
    // Alternate double bonds around system (one valid Kekulé pattern)
    const edges = [
      [0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,6,1],[6,7,2],[7,8,1],[8,9,2],[9,0,1],
      // Add the fusion bond across middle (connect 4-9 and 5-8 to create fused rings)
      [4,9,2],[5,8,2],
      // Hydrogens on outer carbons (0,1,2,3,6,7,8,9) -> 8 H
      [0,10,1],[1,11,1],[2,12,1],[3,13,1],
      [6,14,1],[7,15,1],[8,16,1],[9,17,1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeEthanolTarget() {
    // CH3-CH2-OH
    // Nodes: C0 C1 O2 and 6 Hs
    const nodes = ["C", "C", "O", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      // Hs on C0 (3)
      [0, 3, 1],
      [0, 4, 1],
      [0, 5, 1],
      // Hs on C1 (2)
      [1, 6, 1],
      [1, 7, 1],
      // H on O (1)
      [2, 8, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeDimethylEtherTarget() {
    // CH3-O-CH3
    // Nodes: C0 O1 C2 and 6 Hs
    const nodes = ["C", "O", "C", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      // Hs on C0 (3)
      [0, 3, 1],
      [0, 4, 1],
      [0, 5, 1],
      // Hs on C2 (3)
      [2, 6, 1],
      [2, 7, 1],
      [2, 8, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeBenzeneTarget() {
    // 6 C ring with alternating double bonds, each C has one H.
    const nodes = ["C", "C", "C", "C", "C", "C", "H", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 0, 1],
      [0, 6, 1],
      [1, 7, 1],
      [2, 8, 1],
      [3, 9, 1],
      [4, 10, 1],
      [5, 11, 1],
    ];
    return makeTarget(nodes, edges);
  }

  function makeChlorobenzeneTarget() {
    // Benzene ring with one H replaced by Cl.
    const nodes = ["C", "C", "C", "C", "C", "C", "Cl", "H", "H", "H", "H", "H"];
    const edges = [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 0, 1],
      [0, 6, 1],
      [1, 7, 1],
      [2, 8, 1],
      [3, 9, 1],
      [4, 10, 1],
      [5, 11, 1],
    ];
    return makeTarget(nodes, edges);
  }

  // ---- boot ----
  if (ui.difficultySelect) {
    ui.difficultySelect.value = currentDifficulty;
    ui.difficultySelect.addEventListener("change", () => setDifficulty(ui.difficultySelect.value));
  }
  initLevels();
  initPalette();
  initBondTools();
  initWorkspaceEvents();
  initControls();
  loadLevel(currentLevelId);
  updateStatus();
  render();
  window.addEventListener("resize", onResize);
})();


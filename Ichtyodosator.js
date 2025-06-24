// === script-donnees.js ===

const maladiesCSV = {
  poisson: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsp4iLfZwfBD82Ei062YMyitAjnCTxLxjRLCRCadTvx2eUrXmmBklA4fuEVlt6UvPy0k9wyv5nrab/pub?gid=451520287&single=true&output=csv",
  crevette: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsp4iLfZwfBD82Ei062YMyitAjnCTxLxjRLCRCadTvx2eUrXmmBklA4fuEVlt6UvPy0k9wyv5nrab/pub?gid=678673236&single=true&output=csv"
};

const traitementCSVUnique = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsp4iLfZwfBD82Ei062YMyitAjnCTxLxjRLCRCadTvx2eUrXmmBklA4fuEVlt6UvPy0k9wyv5nrab/pub?gid=1712069859&single=true&output=csv";
const traitementCrevetteCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsp4iLfZwfBD82Ei062YMyitAjnCTxLxjRLCRCadTvx2eUrXmmBklA4fuEVlt6UvPy0k9wyv5nrab/pub?gid=1712069859&single=true&output=csv";

function getTypeAnimal() {
  return document.getElementById("type-crevette").checked ? "crevette" : "poisson";
}

function chargerMaladies() {
  const type = getTypeAnimal();
  const url = maladiesCSV[type];

  fetch(url)
    .then(r => r.text())
    .then(csv => {
      const parsed = Papa.parse(csv, { header: true });
      const data = parsed.data.filter(row => row["Nom maladie"]);

      const select = document.getElementById("maladie");
      select.innerHTML = '<option value="">-- Choisissez une affection --</option>';

      data.forEach(row => {
        const maladie = row["Nom maladie"]?.trim();
        const typeMaladie = row["typemaladie"]?.trim();
        if (maladie && typeMaladie) {
          const option = document.createElement("option");
          option.value = maladie;
          option.textContent = maladie;
          option.dataset.typemaladie = typeMaladie;
          select.appendChild(option);
        }
      });
    });
}

function chargerOriginesFiltrees(typeMaladie) {
  const select = document.getElementById("origine");
  select.innerHTML = '<option value="">-- Sélectionnez l\'origine --</option>';

  const toutes = getTypeAnimal() === "crevette"
    ? [
        { val: "🧫🦐", txt: "🧫 Bactérienne" },
        { val: "🍄🦐", txt: "🍄 Fongique" }
      ]
    : [
        { val: "🧫int", txt: "🧫 Bactérienne interne" },
        { val: "🧫ext", txt: "🧫 Bactérienne externe" },
        { val: "🍄ext", txt: "🍄 Fongique" },
        { val: "🐍int", txt: "🐍 Parasite interne (vers)" },
        { val: "🦠int", txt: "🦠 Parasite interne (protozoaire)" },
        { val: "🐍ext", txt: "🐍 Parasite externe (vers)" },
        { val: "🦟ext", txt: "🦟 Parasite externe (poux-crustacés-isopodes)" },
        { val: "🦠ext", txt: "🦠 Parasite externe (protozoaire)" },
        { val: "🚚", txt: "🚚 traitements préventifs à l'arrivée" }
      ];

  const clean = typeMaladie.replace(/\s/g, "");

  toutes.forEach(({ val, txt }) => {
    if (clean.includes(val)) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = txt;
      select.appendChild(opt);
    }
  });
}

function chargerTraitementsSelonOrigine() {
  const typeAnimal = getTypeAnimal();
  const traitementSelect = document.getElementById("traitement");
  traitementSelect.innerHTML = '<option value="">-- Sélectionnez un traitement --</option>';
  document.getElementById("resultats").innerHTML = "";

  const filtre = document.getElementById("origine").value;
  if (!filtre) return;

  const url = typeAnimal === "crevette" ? traitementCrevetteCSV : traitementCSVUnique;

  fetch(url)
    .then(r => r.text())
    .then(csv => {
      const data = Papa.parse(csv, { header: true }).data;
      const lignes = data.filter(row => row["Produit"] && row["Type"]?.replace(/\s/g, "").includes(filtre));

      lignes.forEach(row => {
        const opt = document.createElement("option");
        opt.value = row["Produit"];
        opt.innerHTML = row["Nom menu"] || row["Produit"];
        opt.dataset.recap = row["Récapitulatif"] || "";
        opt.dataset.remarque = row["Remarque"] || "";
        opt.dataset.references = row["Références"] || "";
        traitementSelect.appendChild(opt);
      });

      // Réinitialise le listener au cas où il a été écrasé
      traitementSelect.removeEventListener("change", afficherDetailsTraitement);
      traitementSelect.addEventListener("change", afficherDetailsTraitement);
    });
}

document.getElementById("traitement").addEventListener("change", afficherDetailsTraitement);

function remplacerJourParDate(texte) {
  return texte.replace(/(?:Jour|J)\s?(\d+)/gi, (_, jour) => {
    const date = new Date();
    date.setDate(date.getDate() + parseInt(jour, 10) - 1);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  });
}
  function afficherDetailsTraitement(e) {
  const volume = parseFloat(document.getElementById("volume").value);
  if (isNaN(volume)) return;

  const consent = document.getElementById("consentement");
  if (!consent || !consent.checked) {
    alert("⚠︎ Veuillez confirmer que vous allez vérifier les instructions !");
    e.target.value = "";
    document.getElementById("resultats").innerHTML = "";
    document.getElementById("plan-action").innerHTML = "";
    return;
  }

  const opt = e.target.selectedOptions[0];
  let recap = opt.dataset.recap || "";
  const remarque = opt.dataset.remarque || "";
  const references = opt.dataset.references || "";

  try {
    recap = new Function("volume", "return `" + recap + "`")(volume);
    recap = remplacerJourParDate(recap);
    recap = recap.replace(/<br\s*\/?>/gi, '<hr style="margin: 6px 0; border: none; border-top: 1px solid #ccc;">');
  } catch {
    recap = "[Erreur dans le format du récapitulatif]";
  }

     // Le reste
  document.getElementById("resultats").innerHTML = `
    <table>
      <tr style="margin-top: 30px; font-size: 1.4rem;">
        <th>Produit</th>
        <th>Remarque</th>
        <th>Références</th>
      </tr>
      <tr style="margin-top: 30px; font-size: 1.2rem;">
        <td>${opt.value}</td>
        <td>${remarque}</td>
        <td>${references}</td>
      </tr>
    </table>
  `;

  // Plan d'action seul
  document.getElementById("plan-action").innerHTML = `
     <table>
    <tr style="margin-top: 30px; font-size: 1.4rem;">
    <th> Plan d'action personnalisé :</th>
    </tr>
    <tr style="margin-top: 30px; font-size: 1.2rem;">
    <td><div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px;">${recap}</div></td>
    </tr>
    </table>
  `;

}

function preselectionnerOrigineDepuisMaladie() {
  const maladieSelect = document.getElementById("maladie");
  const origineSelect = document.getElementById("origine");
  const typeMaladie = maladieSelect.selectedOptions[0]?.dataset?.typemaladie || "";

  if (!typeMaladie) return;

  chargerOriginesFiltrees(typeMaladie);

  const valeursPossibles = Array.from(origineSelect.options).map(o => o.value).filter(Boolean);
  const selection = valeursPossibles.find(val => typeMaladie.replace(/\s/g, "").includes(val));

  if (selection) {
    origineSelect.value = selection;
    chargerTraitementsSelonOrigine();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  chargerMaladies();
  document.getElementById("type-poisson").addEventListener("change", () => {
    chargerMaladies();
    document.getElementById("origine").innerHTML = "";
    document.getElementById("traitement").innerHTML = "";
    document.getElementById("resultats").innerHTML = "";
  });
  document.getElementById("type-crevette").addEventListener("change", () => {
    chargerMaladies();
    document.getElementById("origine").innerHTML = "";
    document.getElementById("traitement").innerHTML = "";
    document.getElementById("resultats").innerHTML = "";
  });
  document.getElementById("origine").addEventListener("change", chargerTraitementsSelonOrigine);
  document.getElementById("maladie").addEventListener("change", preselectionnerOrigineDepuisMaladie);
});

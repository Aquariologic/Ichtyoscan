const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSv-4gYSHRIJcOSqh8sBEwvodnbtNmALhmAcQLDCk9TWuP7v1Nrkjp3RXWn-SqrZfpNdOfUr0Yrqh8M/pub?output=csv';
const maladies = {};

function formatText(text) {
  return text ? text.replace(/\n/g, '<br>') : "";
}

Papa.parse(SHEET_URL, {
  download: true,
  header: true,
  complete: function(results) {
    results.data.forEach(row => {
      if (row.ID) maladies[row.ID.trim()] = row;
    });
  }
});

function showDescription(containerId, id) {
  const data = maladies[id];
  if (!data) return;

  const sections = [
    { title: "Origine(s)", key: "Origine" },
    { title: "Diagnostic différentiel", key: "Diagnostic différentiel" },
    { title: "Causes possibles", key: "Causes" },
    { title: "Traitement(s) envisageable(s)", key: "Traitement" },
    { title: "Quand consulter son véto ?", key: "Quand consulter" },
    { title: "Mesures de prévention", key: "Prévention" }
  ];

  let html = `<div class='maladie'>
    <h3>${formatText(data["Nom maladie"])}</h3>`;

  sections.forEach((section, index) => {
    const content = formatText(data[section.key]);
    if (content) {
      html += `
      <div class="accordion-section">
        <div class="accordion-header" data-index="${index}">
          ${section.title}
        </div>
        <div class="accordion-content">
          ${content}
        </div>
      </div>`;
    }
  });

  html += `</div>`;

  const container = document.getElementById(containerId);
  container.innerHTML = html;
  container.style.display = 'block';

  // Ajout du comportement d'accordéon après insertion HTML
  const headers = container.querySelectorAll(".accordion-header");
  headers.forEach(header => {
    header.addEventListener("click", () => {
      const section = header.parentElement;
      section.classList.toggle("active");
    });
  });
}

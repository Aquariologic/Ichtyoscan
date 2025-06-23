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

  sections.forEach((section) => {
    const content = formatText(data[section.key]);
    if (content) {
      html += `
      <div class="accordion-section">
        <div class="accordion-header" onclick="this.classList.toggle('active')">
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
}

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

  const html = `
  <div class='maladie'>
    <h3>${formatText(data["Nom maladie"])}</h3>

    <div class='section'>
      <div style="text-align: center; font-size: 1.8rem;">
        <strong>Origine(s)&nbsp;:<br></strong>
      </div>
      ${formatText(data["Origine"])}<br>
    </div>

    ${data["Diagnostic différentiel"] ? `
      <div class='section'>
        <div style="text-align: center; font-size: 1.8rem;">
          <strong>Diagnostic différentiel&nbsp;:<br></strong>
        </div>
        ${formatText(data["Diagnostic différentiel"])}<br>
      </div>
    ` : ""}

    <div class='section'>
      <div style="text-align: center; font-size: 1.8rem;">
        <strong>Causes possibles&nbsp;:<br></strong>
      </div>
      ${formatText(data["Causes"])}<br>
    </div>

    <div class='section'>
      <div style="text-align: center; font-size: 1.8rem;">
        <strong>Traitement(s) envisageable(s)&nbsp;:<br></strong>
      </div>
      ${formatText(data["Traitement"])}<br>
    </div>

    <div class='section'>
      <div style="text-align: center; font-size: 1.8rem;">
        <strong>Quand consulter son véto&nbsp;?<br></strong>
      </div>
      ${formatText(data["Quand consulter"])}<br>
    </div>

    <div class='section'>
      <div style="text-align: center; font-size: 1.8rem;">
        <strong>Mesures de prévention&nbsp;:<br></strong>
      </div>
      ${formatText(data["Prévention"])}<br>
    </div>
  </div>
`;


  const container = document.getElementById(containerId);
  container.innerHTML = html;
  container.style.display = 'block';
}

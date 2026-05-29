/* Beispieldaten Team-Übersicht (illustrativ, read-only) */

const TEAM_EXAMPLES_DISCLAIMER =
  "Diese Beispiele sind illustrativ – bitte eigene, bereichsspezifische Antworten formulieren.";

const TEAM_EXAMPLES = {
  title: "Beispiel: Teamübersicht (realcore)",
  headerTheme: "blue",
  rows: [
    {
      bereich: "Produktentwicklung",
      headcount: 8,
      rollenmix: ["50% Entwickler", "30% Architekten", "20% UX/Design"],
      schwerpunkt: "Modulentwicklung, API-Design",
      offen: 2,
      ausbau: "+3 (Dev)",
      status: "orange",
      bemerkung: "Architekten-Engpass",
    },
    {
      bereich: "Vertrieb / Pre-Sales",
      headcount: 6,
      rollenmix: ["50% Account Mgr", "30% Solution Arch.", "20% Marketing"],
      schwerpunkt: "Go-to-Market, Pipeline-Aufbau",
      offen: 1,
      ausbau: "+2 (Sales)",
      status: "orange",
      bemerkung: "Kein Produkt-Marketing",
    },
    {
      bereich: "Delivery / Projekte",
      headcount: 15,
      rollenmix: ["60% Berater", "25% Entwickler", "15% PM"],
      schwerpunkt: "Kundenprojekte, Integration",
      offen: 0,
      ausbau: "+0",
      status: "green",
      bemerkung: "Auslastung hoch",
    },
  ],
};

/* Beispieldaten Skill-Matrix (Legacy-Matrix-Ansicht, illustrativ) */

const SKILL_MATRIX_EXAMPLES_DISCLAIMER =
  "Diese Beispiele sind illustrativ – bitte eigene, bereichsspezifische Antworten formulieren.";

const SKILL_MATRIX_EXAMPLES_BY_KIND = {
  technologie: {
    title: "Beispiel: Technologie- & Delivery-Rollen",
    headerTheme: "blue",
    rows: [
      {
        name: "Mustermann, A.",
        rolle: "Entwickler",
        technologie: ["API Design 4", "Cloud Services 3", "Datenbanken 3"],
        methodik: ["Agile/Scrum 3", "CI/CD 2"],
        soft: ["Teamarbeit 3", "Dokumentation 4"],
        zertifikate: "Cloud Cert.",
        ziel: "API-Experte",
      },
      {
        name: "Beispiel, B.",
        rolle: "Solution Arch.",
        technologie: ["Integration 4", "Microservices 3", "Security 2"],
        methodik: ["Enterprise Arch. 4", "Requirements 3"],
        soft: ["Praesentation 4", "Kundenkomm. 5"],
        zertifikate: "TOGAF",
        ziel: "Produkt-Architekt",
      },
      {
        name: "Muster, C.",
        rolle: "Account Mgr",
        technologie: ["CRM 3", "Demo-Umgebung 2"],
        methodik: ["Sales Process 4", "Pipeline Mgmt 3"],
        soft: ["Verhandlung 5", "Storytelling 4"],
        zertifikate: "Sales Cert.",
        ziel: "Co-Sell Lead",
      },
    ],
  },
  softskill: {
    title: "Beispiel: Soft Skills & Enablement-Rollen",
    headerTheme: "orange",
    rows: [
      {
        name: "Mueller, D.",
        rolle: "HR Business Partner",
        technologie: ["HRIS-Systeme 3", "Reporting 2"],
        methodik: ["Change Mgmt 4", "OE-Methoden 3"],
        soft: ["Moderation 4", "Konfliktloesung 4"],
        zertifikate: "Change Cert.",
        ziel: "OE-Spezialist",
      },
      {
        name: "Schmidt, E.",
        rolle: "Learning Manager",
        technologie: ["LMS-Plattformen 4", "Content Design 3"],
        methodik: ["Didaktik 4", "Blended Learning 3"],
        soft: ["Kommunikation 4", "Coaching 3"],
        zertifikate: "Train-the-Trainer",
        ziel: "Academy-Leitung",
      },
      {
        name: "Weber, F.",
        rolle: "Teamlead",
        technologie: ["Fachsystem 3", "Cloud Basics 2"],
        methodik: ["Projektmgmt 3", "Agile 2"],
        soft: ["Fuehrung 4", "Feedback 3"],
        zertifikate: "Leadership Progr.",
        ziel: "Mentor Level 2",
      },
    ],
  },
};

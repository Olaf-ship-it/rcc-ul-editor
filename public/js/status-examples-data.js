/* Beispieldaten IST-Status je Workstream (illustrativ, read-only) */

const STATUS_EXAMPLES_DISCLAIMER =
  "Diese Beispiele sind illustrativ – bitte eigene, bereichsspezifische Antworten formulieren.";

const STATUS_EXAMPLES_BY_WS = {
  "Portfolio & Markt": {
    title: "Beispiel: Portfolio & Markt (realcore Retail)",
    headerTheme: "blue",
    rows: [
      {
        kategorie: "Produkte / Services / Lösungen",
        stand: [
          "SAP S/4HANA Retail (CAR, POSDM) ist Kernprodukt",
          "AMS-Managed-Services fuer 15+ Retailkunden aktiv",
          "Erste KI-PoCs (AMS Copilot) in Pilotphase",
          "SAP BTP-Integrationsszenarien in Entwicklung",
          "API-Bibliothek mit 10 Standard-Schnittstellen",
        ],
        ampel: "orange",
        kommentar:
          "S/4 Retail ist stark – KI-Module noch nicht produktisiert. AMS Copilot laeuft als PoC mit 2 Bestandskunden (Retailer X, Y).",
      },
      {
        kategorie: "Verteilung / Anteile / KPIs",
        stand: [
          "70 % Umsatz aus klassischen SAP-Projekten",
          "25 % aus AMS / Managed Services",
          "2 aktive KI-Piloten, Pipeline 200 T EUR",
          "Noch kein Subscription-Umsatz",
          "Time-to-Proposal durchschnittlich 8 Tage",
        ],
        ampel: "orange",
        kommentar:
          "Umsatzmix zu projektlastig. KI-Pipeline waechst, Closing-Rate noch niedrig. Subscription-Modell noch nicht definiert.",
      },
      {
        kategorie: "Voraussetzungen / Ressourcen",
        stand: [
          "SAP Diamant-Partner Retail (einziger im DACH-Raum)",
          "Microsoft Gold-Partnerschaft mit Azure-Zugang",
          "Product Owner fuer AMS Copilot benannt",
          "Budget fuer Produktisierung noch in Pruefung",
          "Demo-Umgebung SAP BTP verfuegbar",
        ],
        ampel: "orange",
        kommentar:
          "Partnerstatus ist USP. Budget Produktisierung noch nicht freigegeben. Marketing-Decks fehlen komplett.",
      },
      {
        kategorie: "Abhängigkeiten (intern / extern)",
        stand: [
          "Skills: API- und KI-Expertise fehlt teilweise im Team",
          "Org: Product-Team nicht vollstaendig besetzt",
          "Partner: SAP Co-Sell-Freigabe ausstehend",
          "Extern: SAP-BTP-Release-Zyklen beeinflussen Roadmap",
        ],
        ampel: "orange",
        kommentar:
          "Go-to-Market wartet auf SAP-Co-Sell-Freigabe. Ohne API-Skills kein Scale.",
      },
      {
        kategorie: "Risiken / Blocker",
        stand: [
          "Kein standardisiertes Pricing fuer KI-Module",
          "Pilotkunden-Zugang begrenzt (nur Bestandskunden)",
          "Legal-Prozess fuer SLAs dauert > 6 Wochen",
          "Konkurrenz durch SAP-eigene KI-Features",
          "Kein Customer-Success-Team etabliert",
        ],
        ampel: "red",
        kommentar:
          "Groesstes Risiko: SAP bringt eigene KI-Features – Differenzierung ueber Retail-Tiefe sichern. Legal-Prozess beschleunigen!",
      },
      {
        kategorie: "Verantwortliche / Team",
        stand: [
          "Portfolio Lead KI: [Name]",
          "Sales Lead Retail: [Name]",
          "Product Owner AMS Copilot: [Name]",
          "CTO als technischer Sponsor",
          "COO als Budget-Owner",
        ],
        ampel: "green",
        kommentar:
          "Rollen klar benannt. Fehlend: dedizierter Product Marketing Manager.",
      },
      {
        kategorie: "Stärken / Best Practices",
        stand: [
          "Einziger SAP-Diamant-Partner Retail DACH",
          "Tiefe Branchenexpertise (CAR, Promo, POSDM)",
          "Langjaehrige Kundenbeziehungen",
          "AMS-Delivery-Qualitaet als Vertrauensbasis",
        ],
        ampel: "green",
        kommentar:
          "Retail-Expertise ist groesster USP. AMS-Qualitaet ermoeglicht Upselling zu KI-Modulen bei Bestandskunden.",
      },
      {
        kategorie: "Handlungsfelder (0-6 Monate)",
        stand: [
          "AMS-Copilot-Pilot-Scope finalisieren",
          "Pricing-Blueprint fuer 3 Module erstellen",
          "SAP-Co-Sell-Antrag einreichen",
          "Azure-Marketplace-Listing vorbereiten",
          "3 Pilotkunden aktiv ansprechen",
        ],
        ampel: "orange",
        kommentar:
          "Prioritaet 1: Pilot abschliessen und Referenzcase dokumentieren. Parallel Pricing + Go-to-Market vorbereiten.",
      },
    ],
  },
  "Skills & Mindset": {
    title: "Beispiel: Skills & Mindset (realcore)",
    headerTheme: "orange",
    rows: [
      {
        kategorie: "Produkte / Services / Lösungen",
        stand: [
          "SAP-BTP-Einfuehrungskurse fuer 2 Teams durchgefuehrt",
          "Lernplattform in Pilotphase (50 Teilnehmer)",
          "Change Story v1 kommuniziert (All-Hands)",
          "Erste Peer-Learning-Sessions (monatlich)",
          "Kein Badge-System etabliert",
        ],
        ampel: "orange",
        kommentar:
          "Lernplattform laeuft, Beteiligung nur 30 %. Change Story bekannt, im Alltag noch nicht verankert.",
      },
      {
        kategorie: "Verteilung / Anteile / KPIs",
        stand: [
          "150 MA mit mind. 1 abgeschlossenem Training",
          "Lernzeit Ø 2 h/Monat (Ziel: 4 h)",
          "15 informelle Badges vergeben",
          "0 zertifizierte KI-Trainer intern",
          "Employee NPS: +32",
        ],
        ampel: "orange",
        kommentar:
          "Schulungsquote steigt, Lernzeit unter Ziel. Kein formales Badge-System. Employee NPS verbesserungsfaehig.",
      },
      {
        kategorie: "Voraussetzungen / Ressourcen",
        stand: [
          "Trainingsbudget 2026 (80 T EUR) genehmigt",
          "2 externe Trainer unter Vertrag",
          "Zeitfreigabe nur in 3 von 8 Teams umgesetzt",
          "Kein dedizierter Learning Manager",
          "MS Learn + SAP Learning Hub Lizenzen aktiv",
        ],
        ampel: "orange",
        kommentar:
          "Budget vorhanden, Umsetzung uneinheitlich. Zeitfreigabe in Delivery-Teams fehlt – groesster Hebel.",
      },
      {
        kategorie: "Abhängigkeiten (intern / extern)",
        stand: [
          "Org: Rollenbeschreibungen nicht aktualisiert",
          "Portfolio: Use Cases als Lerninhalt fehlen",
          "Partner: SAP/MS Learning Journeys nicht integriert",
          "HR: Karrierepfade noch nicht mit Skills verknuepft",
        ],
        ampel: "orange",
        kommentar:
          "Ohne aktuelle Rollenprofile keine zielgerichteten Lernpfade. Abstimmung mit HR notwendig.",
      },
      {
        kategorie: "Risiken / Blocker",
        stand: [
          "Hohe Delivery-Auslastung (>90 %) verhindert Lernzeit",
          "Kultur: „Projekt zuerst, Lernen zweitrangig“",
          "KI-Skepsis bei erfahrenen SAP-Beratern",
          "Kein Gamification-Element – geringe Motivation",
          "Trainer-Kapazitaet zu gering fuer Skalierung",
        ],
        ampel: "red",
        kommentar:
          "Kultureller Wandel groesste Herausforderung. Ohne sichtbares Management-Commitment keine Verhaltensaenderung.",
      },
      {
        kategorie: "Verantwortliche / Team",
        stand: [
          "People & Culture Lead: [Name]",
          "Change Coach (extern): [Name]",
          "HR Director als Sponsor",
          "Teamleads als Mentoren (12 Personen)",
          "Kein Learning Manager benannt",
        ],
        ampel: "orange",
        kommentar:
          "Learning Manager muss besetzt werden. Teamleads noch nicht systematisch als Mentoren eingebunden.",
      },
      {
        kategorie: "Stärken / Best Practices",
        stand: [
          "Hohe intrinsische Lernbereitschaft bei Junioren",
          "SAP-Expertise auf sehr hohem Niveau",
          "Peer-Learning-Format gut angenommen",
          "Starke Identifikation mit realcore-Kultur",
        ],
        ampel: "green",
        kommentar:
          "Peer-Learning funktioniert. SAP-Expertise ist Basis fuer Ausbau Richtung KI/Cloud.",
      },
      {
        kategorie: "Handlungsfelder (0-6 Monate)",
        stand: [
          "Learning Manager einstellen",
          "Zeitfreigabe in allen Teams durchsetzen",
          "Badge-System designen und pilotieren",
          "KI-Basics als Pflichttraining fuer alle MA",
          "Mentor-Programm formalisieren",
        ],
        ampel: "orange",
        kommentar:
          "Quick Win: KI-Basics Pflichttraining. Parallel Learning Manager rekrutieren und Badge-System aufsetzen.",
      },
    ],
  },
  "Organisation & Rollen": {
    title: "Beispiel: Organisation & Rollen (realcore)",
    headerTheme: "green",
    rows: [
      {
        kategorie: "Produkte / Services / Lösungen",
        stand: [
          "KI Integration Hub in Gruendungsphase (2 MA)",
          "Open Source Guild: Charter v1 verabschiedet",
          "Community of Practice Retail (monatlich, 15 TN)",
          "RACI fuer Kernprojekte teilweise definiert",
          "Operating Model v2 dokumentiert",
        ],
        ampel: "orange",
        kommentar:
          "Hub existiert als Keimzelle, noch kein Vollteam. Guild laeuft, Output noch gering.",
      },
      {
        kategorie: "Verteilung / Anteile / KPIs",
        stand: [
          "6 offene Rollen (davon 2 kritisch: KI-Mgr, Architect)",
          "70 % Projekte mit Cross-Unit-Zusammenarbeit",
          "Employee NPS: +30",
          "RACI-Abdeckung: ca. 50 % der Initiativen",
          "Time-to-Staffing Ø 6 Wochen",
        ],
        ampel: "orange",
        kommentar:
          "Cross-Unit-Arbeit gut, RACI nicht flaechendeckend. Recruiting zu langsam fuer kritische Rollen.",
      },
      {
        kategorie: "Voraussetzungen / Ressourcen",
        stand: [
          "Rollenprofile fuer 80 % der Positionen definiert",
          "Collaboration-Tools aktiv (Teams, Miro, Confluence)",
          "Budget fuer Hub-Aufbau in GF-Diskussion",
          "Governance-Prozess teilweise implementiert",
          "Leadership-Training fuer Teamleads geplant",
        ],
        ampel: "orange",
        kommentar:
          "Rollenprofile vorhanden, nicht alle aktuell (KI-Rollen fehlen). Hub-Budget noch nicht freigegeben.",
      },
      {
        kategorie: "Abhängigkeiten (intern / extern)",
        stand: [
          "Skills: KI-Integratoren und Agent Engineers fehlen",
          "Portfolio: Pilotprojekte als Praxis fuer Hub-Team",
          "Partner: Co-Development-Modelle noch nicht definiert",
          "HR: Recruiting-Kapazitaet begrenzt (1 Recruiter)",
        ],
        ampel: "orange",
        kommentar:
          "Hub skaliert erst, wenn Skill-Pipeline und Recruiting parallel hochfahren.",
      },
      {
        kategorie: "Risiken / Blocker",
        stand: [
          "Silodenken zwischen SAP-Delivery und Innovation",
          "Widerstand mittleres Management (Kontrollverlust)",
          "COO/CTO-Abstimmung nicht immer einheitlich",
          "Guild-Engagement sinkt ohne sichtbare Ergebnisse",
          "Schluesselpersonen-Abhaengigkeit (2–3 Wissenstraeger)",
        ],
        ampel: "red",
        kommentar:
          "SAP-Delivery sieht Hub als Konkurrenz. Braucht klare Kommunikation und gemeinsame Ziele.",
      },
      {
        kategorie: "Verantwortliche / Team",
        stand: [
          "COO: Owner Hub-Setup + Operating Model",
          "CTO: Technische Governance + Architecture",
          "HR: Recruiting, Organisationsentwicklung",
          "Transformation PMO: Koordination",
          "Externe Beratung: Change-Begleitung",
        ],
        ampel: "green",
        kommentar:
          "Verantwortlichkeiten klar. Transformation PMO nur 0,5 FTE – muss aufgestockt werden.",
      },
      {
        kategorie: "Stärken / Best Practices",
        stand: [
          "Flache Hierarchien, kurze Entscheidungswege",
          "Starke SAP-Delivery-Organisation (eingespielt)",
          "CoP Retail als funktionierendes Wissensformat",
          "Hohe Identifikation der MA mit realcore",
        ],
        ampel: "green",
        kommentar:
          "Flache Strukturen sind Vorteil fuer schnellen Hub-Aufbau. CoP-Format auf andere Streams uebertragbar.",
      },
      {
        kategorie: "Handlungsfelder (0-6 Monate)",
        stand: [
          "KI-Manager einstellen (Prioritaet 1)",
          "Hub-Budget freigeben lassen (GF-Entscheidung)",
          "RACI fuer alle Transformationsinitiativen erstellen",
          "Guild-Output steigern (1 Reuse-Baustein/Monat)",
          "Leadership-Training durchfuehren",
        ],
        ampel: "orange",
        kommentar:
          "Ohne KI-Manager kein Hub-Scale. Budgetentscheidung bis Ende Q1. RACI als Quick Win.",
      },
    ],
  },
  "Partner & Ecosystem": {
    title: "Beispiel: Partner & Ecosystem (realcore)",
    headerTheme: "purple",
    rows: [
      {
        kategorie: "Produkte / Services / Lösungen",
        stand: [
          "SAP-Diamant-Partnerschaft Retail aktiv",
          "Microsoft-Gold-Partnerschaft aktiv",
          "Co-Sell-Draft mit SAP unterzeichnet",
          "Azure-Partnerschaft registriert",
          "Keine aktiven Joint Reference Cases",
          "Kein Marketplace-Listing vorhanden",
        ],
        ampel: "orange",
        kommentar:
          "Partnerstatus stark, wird kommerziell noch nicht genutzt. Kein einziger Co-Sell-Deal bisher.",
      },
      {
        kategorie: "Verteilung / Anteile / KPIs",
        stand: [
          "2 strategische Partnergespraeche/Quartal",
          "0 gemeinsame Co-Sell-Deals",
          "0 Marketplace Listings",
          "1 gemeinsamer SAP-Event-Auftritt/Jahr",
          "Keine Joint-Marketing-Kampagnen",
        ],
        ampel: "red",
        kommentar:
          "Partner-KPIs praktisch bei null. Partnerschaften formal, ohne kommerzielle Aktivierung.",
      },
      {
        kategorie: "Voraussetzungen / Ressourcen",
        stand: [
          "Partnervertraege (SAP/MS) aktiv und aktuell",
          "1 Alliance Manager (Teilzeit, 50 %)",
          "Marketing-Material in Erstellung",
          "SAP Solution Brief als Entwurf",
          "Kein Partner-Portal vorhanden",
        ],
        ampel: "orange",
        kommentar:
          "Alliance Manager nur 50 % dediziert. Marketing-Material nicht fertig. Partner-Portal wichtig fuer Sichtbarkeit bei SAP/MS Sales.",
      },
      {
        kategorie: "Abhängigkeiten (intern / extern)",
        stand: [
          "Portfolio: Module muessen marktreif sein fuer Co-Sell",
          "Org: Alliance-Rolle muss Vollzeit werden",
          "Skills: Co-Sell-Training fuer Sales-Team fehlt",
          "Extern: SAP/MS-Freigabeprozesse dauern 8–12 Wochen",
          "Legal: Vertragsvorlagen fuer Joint-Projekte fehlen",
        ],
        ampel: "orange",
        kommentar:
          "Co-Sell nur mit fertigen Modulen und geschultem Sales-Team. Parallel Legal-Templates vorbereiten.",
      },
      {
        kategorie: "Risiken / Blocker",
        stand: [
          "SAP-Partner-Team wechselt Ansprechpartner haeufig",
          "Kein lokaler Referenzcase fuer Co-Sell-Gespraeche",
          "Microsoft-Azure-Co-Sell-Anforderungen unklar",
          "Budget fuer gemeinsame Events fehlt",
          "Konkurrenz durch andere SAP-Partner (Accenture etc.)",
        ],
        ampel: "red",
        kommentar:
          "Ohne Referenzcase kein Co-Sell. Ansprechpartner-Wechsel bei SAP erschwert Kontinuitaet. Differenzierung ueber Retail-Tiefe entscheidend.",
      },
      {
        kategorie: "Verantwortliche / Team",
        stand: [
          "Alliance Manager: [Name] (50 % Kapazitaet)",
          "Sales Lead Retail: [Name]",
          "Marketing Lead: [Name]",
          "COO: Sign-off fuer Partner-Investments",
          "CTO: Technische Abstimmung mit SAP/MS",
        ],
        ampel: "orange",
        kommentar:
          "Alliance Manager muss auf 100 % aufgestockt werden. Ggf. zweite Rolle fuer MS-Partnerschaft.",
      },
      {
        kategorie: "Stärken / Best Practices",
        stand: [
          "Einziger SAP-Diamant-Partner Retail im DACH",
          "Persoenliche Kontakte zum SAP-Retail-Team",
          "Microsoft-Gold-Status als Basis fuer Azure Co-Sell",
          "Langjaehrige Branchenreputation im Handel",
        ],
        ampel: "green",
        kommentar:
          "Diamant-Status einzigartig und oeffnet Tueren. Persoenliche SAP-Kontakte systematisieren!",
      },
      {
        kategorie: "Handlungsfelder (0-6 Monate)",
        stand: [
          "Alliance Manager auf 100 % aufstocken",
          "SAP-Co-Sell-Meeting mit Retail-Team organisieren",
          "Ersten Referenzcase dokumentieren (AMS Copilot Pilot)",
          "Azure-Marketplace-Listing vorbereiten",
          "Joint Webinar mit SAP planen (Q2)",
          "Partner Sales Playbook erstellen",
        ],
        ampel: "orange",
        kommentar:
          "Prioritaet 1: Referenzcase + Co-Sell-Aktivierung. Quick Win: gemeinsames Webinar mit SAP Retail-Team in Q2.",
      },
    ],
  },
};

/*
 * Sr. Eve's Clinic: single source of truth for clinic details.
 *
 * Only the clinic name and opening hours have been supplied. Everything else is
 * null until the clinic verifies it. The pages show a clear "to be confirmed"
 * state for null values and hide actions (call, email, WhatsApp, map) that would
 * otherwise point at nothing.
 *
 * Never put secrets, API keys or tokens in this file: it is public.
 */
window.CLINIC = {
  name: "Sr. Eve\u2019s Clinic",

  /* Supplied by the clinic. days: 0 = Sunday ... 6 = Saturday */
  hours: [
    { id: "weekdays", label: "Monday \u2013 Friday", days: [1, 2, 3, 4, 5], open: "08:30", close: "19:00" },
    { id: "weekend", label: "Saturday \u2013 Sunday", days: [0, 6], open: "09:00", close: "14:00" }
  ],

  /* Length of one requested appointment window (minutes). Only used to offer time choices. */
  slotMinutes: 30,

  /* NOT yet supplied. Fill in once the clinic has verified them. */
  contact: {
    phone: null,        // e.g. "+27 12 345 6789"
    whatsapp: null,     // international format, digits only, e.g. "27123456789"
    email: null,        // e.g. "info@example.com"
    address: null,      // e.g. "12 Example Street, Town"
    mapEmbedUrl: null,  // Google Maps "Embed a map" iframe src (https only)
    mapLink: null       // plain Google Maps link for directions (https only)
  },

  /* Original files, unmodified. Put them in assets/brand and assets/images, then set the paths. */
  assets: {
    logo: null,         // e.g. "assets/brand/logo.png"
    /* TEMPORARY stock photos (from Pexels / Unsplash). Replace with the clinic's own photography. */
    hero: "assets/images/hero-temp.jpg",
    about: "assets/images/about-temp.jpg"
  },

  /* Payment / medical aid wording. Leave null until the clinic confirms it. */
  paymentInfo: null,

  /*
   * Backend integration points (HTTPS only; see README for the request/response contract).
   * Blank = feature is off and the site says so honestly instead of pretending to work.
   */
  integrations: {
    bookingEndpoint: null,       // receives appointment requests (POST, JSON)
    availabilityEndpoint: null,  // optional: returns real free slots (POST, JSON)
    contactEndpoint: null        // receives contact-form messages (POST, JSON)
  },

  /* Options for every service dropdown. */
  services: [
    { id: "womens-wellness", title: "Women\u2019s Wellness", group: "Our services" },
    { id: "family-planning", title: "Family Planning", group: "Our services" },
    { id: "antenatal-care", title: "Antenatal Care", group: "Our services" },
    { id: "general-health", title: "General Health", group: "Our services" },
    { id: "testing-screening", title: "Testing & Screening", group: "Our services" },
    { id: "skin-aesthetic", title: "Skin & Aesthetic Care", group: "Our services" },
    { id: "chronic-disease-management", title: "Chronic disease management", group: "Additional services" },
    { id: "immunisation", title: "Immunisation", group: "Additional services" },
    { id: "wound-dressing", title: "Wound dressing", group: "Additional services" },
    { id: "blood-pressure-monitoring", title: "Blood pressure monitoring", group: "Additional services" },
    { id: "glucose-testing", title: "Glucose / sugar testing", group: "Additional services" },
    { id: "weight-loss-programmes", title: "Weight loss programmes", group: "Additional services" },
    { id: "termination-of-pregnancy", title: "Safe termination of pregnancy services", group: "Additional services" },
    { id: "other", title: "Other / not sure", group: "Other" }
  ]
};

/**
 * "Small Business SaaS": the second sample project. A multi-tenant data
 * model seeded for five businesses (a salon, a restaurant, a contractor, a
 * clinic and a shop), and four apps composed as page sets over the same
 * tables:
 *
 *   pages/apps/customer/*   mobile-first customer app (bottom tab bar, the
 *                           tenant's brand colors)
 *   pages/apps/admin/*      responsive back office (role-gated side menu,
 *                           tenant and role switchers)
 *   pages/site/*            the marketing site of the SaaS itself
 *   pages/growth/social/*   post templates, content calendar, ad A/B, assets
 *   pages/growth/outreach/* CRM: leads kanban, sequence builder, touch log,
 *                           call sheet
 *
 * Every data-bound block filters by `tenant_id=@tenant`; the preview
 * context (`?tenant=2&role=3` on an entry, or the switchers) picks the
 * business and the viewer's role. `boards/showcase.json` tours it all.
 * Everything here is deterministic data; nothing is fetched.
 */
import { starterDesignFiles } from "@/design/starter";
import type { BoardDef } from "@/boards/model";
import type { FileMap } from "./types";

export const SAAS_NAME = "Small Business SaaS";

export const BUSINESS_TYPES = [
  "salon",
  "restaurant",
  "contractor",
  "clinic",
  "retail",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

function thumb(bg: string, letter: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='72' viewBox='0 0 96 72'><rect width='96' height='72' rx='12' fill='${bg}'/><text x='48' y='46' font-family='sans-serif' font-size='28' font-weight='700' text-anchor='middle' fill='white'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ----- tenants ---------------------------------------------------------------

export interface TenantSeed {
  id: number;
  name: string;
  slug: string;
  business_type: BusinessType;
  tagline: string;
  brand_primary: string;
  brand_accent: string;
  brand_accent2: string;
  city: string;
  phone: string;
  plan: string;
}

export const TENANTS: TenantSeed[] = [
  {
    id: 1,
    name: "Bloom Salon",
    slug: "bloom",
    business_type: "salon",
    tagline: "Color, cuts and calm.",
    brand_primary: "#b8336a",
    brand_accent: "#f28c6b",
    brand_accent2: "#f6c453",
    city: "Portland",
    phone: "(503) 555-0142",
    plan: "Growth",
  },
  {
    id: 2,
    name: "Ember & Oak",
    slug: "ember-oak",
    business_type: "restaurant",
    tagline: "Wood-fired, neighborhood, nightly.",
    brand_primary: "#9a3412",
    brand_accent: "#f59e0b",
    brand_accent2: "#fde68a",
    city: "Austin",
    phone: "(512) 555-0199",
    plan: "Pro",
  },
  {
    id: 3,
    name: "Northline Contracting",
    slug: "northline",
    business_type: "contractor",
    tagline: "Kitchens, baths and decks, on time.",
    brand_primary: "#1d4ed8",
    brand_accent: "#f97316",
    brand_accent2: "#fbbf24",
    city: "Minneapolis",
    phone: "(612) 555-0117",
    plan: "Growth",
  },
  {
    id: 4,
    name: "Maple Family Clinic",
    slug: "maple-clinic",
    business_type: "clinic",
    tagline: "Same-week appointments for the whole family.",
    brand_primary: "#0f766e",
    brand_accent: "#34d399",
    brand_accent2: "#a7f3d0",
    city: "Burlington",
    phone: "(802) 555-0163",
    plan: "Pro",
  },
  {
    id: 5,
    name: "Paper Goods Co.",
    slug: "paper-goods",
    business_type: "retail",
    tagline: "Stationery worth writing home about.",
    brand_primary: "#6d28d9",
    brand_accent: "#ec4899",
    brand_accent2: "#f9a8d4",
    city: "Savannah",
    phone: "(912) 555-0128",
    plan: "Starter",
  },
];

const SERVICES: Record<
  BusinessType,
  { name: string; category: string; price: number; minutes: number }[]
> = {
  salon: [
    { name: "Haircut", category: "Hair", price: 65, minutes: 45 },
    { name: "Color", category: "Hair", price: 140, minutes: 120 },
    { name: "Blowout", category: "Hair", price: 45, minutes: 30 },
    { name: "Manicure", category: "Nails", price: 38, minutes: 40 },
    { name: "Facial", category: "Skin", price: 95, minutes: 60 },
  ],
  restaurant: [
    { name: "Table for 2", category: "Dinner", price: 0, minutes: 90 },
    { name: "Table for 4", category: "Dinner", price: 0, minutes: 105 },
    { name: "Private dining", category: "Events", price: 600, minutes: 180 },
    { name: "Tasting menu", category: "Dinner", price: 95, minutes: 150 },
    { name: "Takeout pickup", category: "Takeout", price: 0, minutes: 15 },
  ],
  contractor: [
    { name: "Site visit", category: "Estimate", price: 0, minutes: 60 },
    {
      name: "Kitchen remodel",
      category: "Remodel",
      price: 24000,
      minutes: 480,
    },
    {
      name: "Bathroom remodel",
      category: "Remodel",
      price: 12500,
      minutes: 480,
    },
    { name: "Deck build", category: "Exterior", price: 8800, minutes: 480 },
    { name: "Repair call", category: "Service", price: 180, minutes: 90 },
  ],
  clinic: [
    { name: "Check-up", category: "General", price: 120, minutes: 30 },
    { name: "Dental cleaning", category: "Dental", price: 150, minutes: 45 },
    { name: "Physio session", category: "Physio", price: 90, minutes: 45 },
    { name: "Vaccination", category: "General", price: 40, minutes: 15 },
    { name: "Consultation", category: "General", price: 160, minutes: 30 },
  ],
  retail: [
    { name: "Personal shopping", category: "In store", price: 0, minutes: 45 },
    { name: "Gift wrapping", category: "In store", price: 8, minutes: 10 },
    { name: "Custom stationery", category: "Custom", price: 120, minutes: 30 },
    {
      name: "Calligraphy workshop",
      category: "Events",
      price: 55,
      minutes: 120,
    },
    { name: "Click & collect", category: "Online", price: 0, minutes: 5 },
  ],
};

const MENU_BY_TYPE: Record<BusinessType, { label: string; icon: string }> = {
  salon: { label: "Chair schedule", icon: "calendar" },
  restaurant: { label: "Menu & tables", icon: "list" },
  contractor: { label: "Job sites", icon: "map" },
  clinic: { label: "Patient intake", icon: "heart" },
  retail: { label: "Inventory", icon: "grid" },
};

const FIRST = [
  "Ada",
  "Grace",
  "Linus",
  "Maya",
  "Omar",
  "Priya",
  "Theo",
  "Zoe",
  "Ivan",
  "Nora",
  "Felix",
  "Hana",
  "Leo",
  "Sofia",
  "Kai",
  "Elena",
  "Marco",
  "Yara",
  "Dev",
  "Ines",
  "Ruth",
  "Jonas",
  "Amara",
  "Tomas",
  "Lucia",
  "Ravi",
  "Mila",
  "Sam",
  "Bea",
  "Noah",
];
const LAST = [
  "Lovelace",
  "Hopper",
  "Torvalds",
  "Okafor",
  "Haddad",
  "Nair",
  "Brandt",
  "Lindqvist",
  "Petrov",
  "Quinn",
  "Adler",
  "Sato",
  "Costa",
  "Reyes",
  "Mori",
  "Novak",
  "Rossi",
  "Khalil",
  "Patel",
  "Duarte",
  "Bloom",
  "Weber",
  "Achebe",
  "Silva",
  "Ortega",
  "Iyer",
  "Horvat",
  "Carter",
  "Fischer",
  "Meyer",
];
const LEAD_BUSINESSES = [
  "Harbor Dental",
  "Cedar & Co.",
  "Riverside Yoga",
  "Bright Path Tutoring",
  "Marlow Realty",
  "The Corner Bakery",
  "Summit Physio",
  "Oak Street Books",
  "Lantern Coffee",
  "Willow Florals",
  "Peak Auto",
  "Juniper Kids",
];
const SOURCES = [
  "referral",
  "instagram",
  "google",
  "walk-in",
  "website",
  "event",
];
const STAGES = ["New", "Contacted", "Qualified", "Won", "Lost"];
const CHANNELS = ["instagram", "facebook", "tiktok", "email"];
const TONES = ["#b8336a", "#9a3412", "#1d4ed8", "#0f766e", "#6d28d9"];

/** Zero-padded day of September 2026 (the month the seeded calendars show). */
const day = (d: number, month = 9) =>
  `2026-${String(month).padStart(2, "0")}-${String(Math.min(Math.max(d, 1), 28)).padStart(2, "0")}`;

const ROLES = [
  {
    id: 4,
    name: "owner",
    level: 4,
    description: "Everything, including billing and the team.",
  },
  {
    id: 3,
    name: "manager",
    level: 3,
    description: "Runs the day: bookings, customers, invoices, growth.",
  },
  {
    id: 2,
    name: "staff",
    level: 2,
    description: "Their own schedule and customers.",
  },
  {
    id: 1,
    name: "customer",
    level: 1,
    description: "Books and pays through the customer app.",
  },
];
const AREAS = [
  "bookings",
  "customers",
  "invoices",
  "growth",
  "team",
  "settings",
];

interface Seed {
  tenants: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  permissions: Record<string, unknown>[];
  users: Record<string, unknown>[];
  menu_items: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  services: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  leads: Record<string, unknown>[];
  sequences: Record<string, unknown>[];
  touches: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  campaigns: Record<string, unknown>[];
  assets: Record<string, unknown>[];
}

/** Rows for every table, for every tenant. Deterministic. */
export function saasSeed(): Seed {
  const s: Seed = {
    tenants: TENANTS.map((t) => ({ ...t })),
    roles: ROLES,
    permissions: [],
    users: [],
    menu_items: [],
    customers: [],
    services: [],
    bookings: [],
    invoices: [],
    leads: [],
    sequences: [],
    touches: [],
    posts: [],
    campaigns: [],
    assets: [],
  };
  let pid = 0;
  for (const r of ROLES)
    for (const area of AREAS)
      s.permissions.push({
        id: ++pid,
        role_id: r.id,
        area,
        can_edit:
          r.level >= 4 ||
          (r.level === 3 && area !== "settings" && area !== "team") ||
          (r.level === 2 && (area === "bookings" || area === "customers")),
      });

  // Menus: the admin side menu (grouped, gated), the customer tabs, growth.
  const admin: [
    string,
    string,
    string,
    string,
    number | null,
    BusinessType | null,
  ][] = [
    ["Dashboard", "#/apps/admin/dashboard", "home", "Operate", null, null],
    ["Bookings", "#/apps/admin/bookings", "calendar", "Operate", null, null],
    ["Customers", "#/apps/admin/customers", "users", "Operate", null, null],
    ["Invoices", "#/apps/admin/invoices", "chart", "Operate", 3, null],
    ["Leads", "#/growth/outreach/leads", "star", "Grow", 3, null],
    ["Sequences", "#/growth/outreach/sequences", "list", "Grow", 3, null],
    [
      "Social calendar",
      "#/growth/social/calendar",
      "calendar",
      "Grow",
      3,
      null,
    ],
    ["Ads", "#/growth/social/ads", "sparkles", "Grow", 3, null],
    ["Team", "#/apps/admin/team", "users", "Manage", 4, null],
    ["Settings", "#/apps/admin/settings", "settings", "Manage", 4, null],
  ];
  let mid = 0;
  admin.forEach(([label, href, icon, category, role, business], i) =>
    s.menu_items.push({
      id: ++mid,
      label,
      href,
      icon,
      category,
      app: "admin",
      sort: i + 1,
      parent_id: null,
      required_role: role,
      business_type: business,
    })
  );
  for (const type of BUSINESS_TYPES) {
    const m = MENU_BY_TYPE[type];
    s.menu_items.push({
      id: ++mid,
      label: m.label,
      href: "#/apps/admin/bookings",
      icon: m.icon,
      category: "Operate",
      app: "admin",
      sort: 20 + s.menu_items.length,
      parent_id: null,
      required_role: 2,
      business_type: type,
    });
  }
  for (const [i, [label, href, icon]] of (
    [
      ["Home", "#/apps/customer/home", "home"],
      ["Book", "#/apps/customer/book", "calendar"],
      ["Bookings", "#/apps/customer/bookings", "list"],
      ["Profile", "#/apps/customer/profile", "user"],
    ] as const
  ).entries())
    s.menu_items.push({
      id: ++mid,
      label,
      href,
      icon,
      category: "Customer",
      app: "customer",
      sort: i + 1,
      parent_id: null,
      required_role: null,
      business_type: null,
    });

  let uid = 0,
    cid = 0,
    sid = 0,
    bid = 0,
    iid = 0,
    lid = 0,
    qid = 0,
    tid = 0,
    poid = 0,
    caid = 0,
    aid = 0;
  TENANTS.forEach((t, ti) => {
    const tone = TONES[ti];
    // Team: owner, manager, two staff.
    const staff: number[] = [];
    [4, 3, 2, 2].forEach((role, i) => {
      const n = (ti * 4 + i) % FIRST.length;
      const name = `${FIRST[n]} ${LAST[(n + 7) % LAST.length]}`;
      s.users.push({
        id: ++uid,
        tenant_id: t.id,
        name,
        email: `${FIRST[n].toLowerCase()}@${t.slug}.example`,
        role_id: role,
        avatar: thumb(tone, FIRST[n][0]),
        active: i !== 3 || ti % 2 === 0,
        joined: `2025-${String(1 + ((ti + i) % 12)).padStart(2, "0")}-1${i}`,
      });
      staff.push(uid);
    });
    // Customers.
    const customers: number[] = [];
    for (let i = 0; i < 6; i++) {
      const n = (ti * 6 + i + 10) % FIRST.length;
      s.customers.push({
        id: ++cid,
        tenant_id: t.id,
        name: `${FIRST[n]} ${LAST[(n + 3) % LAST.length]}`,
        email: `${FIRST[n].toLowerCase()}.${LAST[(n + 3) % LAST.length].toLowerCase()}@example.com`,
        phone: `(555) 01${ti}${i}-${String(1000 + n * 37).slice(0, 4)}`,
        since: `202${4 + (i % 2)}-${String(1 + ((i * 5 + ti) % 12)).padStart(2, "0")}-0${1 + i}`,
        visits: 1 + ((i * 7 + ti * 3) % 14),
        tags:
          i % 3 === 0
            ? "regular, newsletter"
            : i % 3 === 1
              ? "newsletter"
              : "new",
        vip: i % 3 === 0,
      });
      customers.push(cid);
    }
    // Services.
    const services: { id: number; price: number }[] = [];
    SERVICES[t.business_type].forEach((sv, i) => {
      s.services.push({
        id: ++sid,
        tenant_id: t.id,
        name: sv.name,
        category: sv.category,
        price: sv.price,
        minutes: sv.minutes,
        active: i !== 4 || ti % 2 === 1,
        image: thumb(tone, sv.name[0]),
      });
      services.push({ id: sid, price: sv.price });
    });
    // Bookings across September 2026 and the invoices for the finished ones.
    const statuses = [
      "done",
      "done",
      "confirmed",
      "booked",
      "booked",
      "cancelled",
      "done",
      "booked",
      "confirmed",
      "booked",
    ];
    const times = [
      "09:00",
      "10:30",
      "12:00",
      "13:30",
      "15:00",
      "16:30",
      "18:00",
    ];
    const bookings: {
      id: number;
      customer: number;
      date: string;
      price: number;
      status: string;
    }[] = [];
    for (let i = 0; i < 10; i++) {
      const sv = services[(i + ti) % services.length];
      const date = day(2 + i * 3 - (ti % 3));
      s.bookings.push({
        id: ++bid,
        tenant_id: t.id,
        customer_id: customers[i % customers.length],
        service_id: sv.id,
        staff_id: staff[1 + (i % 3)],
        date,
        time: times[(i + ti) % times.length],
        status: statuses[i],
        notes:
          i % 4 === 0
            ? "First visit"
            : i % 4 === 2
              ? "Asked for the same staff as last time"
              : "",
      });
      bookings.push({
        id: bid,
        customer: customers[i % customers.length],
        date,
        price: sv.price,
        status: statuses[i],
      });
    }
    const invoiceStatus = ["paid", "paid", "sent", "overdue", "paid", "draft"];
    bookings.slice(0, 6).forEach((b, i) => {
      const amount = b.price || 45 + i * 20;
      s.invoices.push({
        id: ++iid,
        tenant_id: t.id,
        customer_id: b.customer,
        booking_id: b.id,
        number: `INV-${t.id}${String(i + 1).padStart(3, "0")}`,
        amount,
        status: invoiceStatus[i],
        issued: b.date,
        due: day(2 + i * 3 - (ti % 3) + 14),
      });
    });
    // Leads, one sequence of four steps, touches.
    const leads: number[] = [];
    for (let i = 0; i < 6; i++) {
      const n = (ti * 5 + i) % LEAD_BUSINESSES.length;
      const c = (ti * 3 + i + 20) % FIRST.length;
      s.leads.push({
        id: ++lid,
        tenant_id: t.id,
        business: LEAD_BUSINESSES[n],
        contact: `${FIRST[c]} ${LAST[(c + 11) % LAST.length]}`,
        email: `${FIRST[c].toLowerCase()}@${LEAD_BUSINESSES[n].toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        phone: `(555) 02${ti}${i}-0${100 + n}`,
        stage: STAGES[(i + ti) % STAGES.length],
        source: SOURCES[(i + ti * 2) % SOURCES.length],
        value: 250 + ((i * 3 + ti) % 7) * 175,
        owner_id: staff[1 + (i % 2)],
        next_step: [
          "Send intro email",
          "Call back Tuesday",
          "Book a site visit",
          "Send proposal",
          "Ask for referral",
          "Follow up in 30 days",
        ][(i + ti) % 6],
        sequence_id: null,
      });
      leads.push(lid);
    }
    const seqName = [
      "Welcome",
      "Win-back",
      "Estimate follow-up",
      "New patient",
      "Launch",
    ][ti];
    const steps: [number, string, string, string][] = [
      [
        0,
        "email",
        "Hello and thanks",
        "One paragraph: who we are, one question about what they need.",
      ],
      [2, "sms", "Quick nudge", "Short text with the booking link. No pitch."],
      [5, "call", "Call", "Ask about timing and budget; offer two slots."],
      [
        10,
        "email",
        "Last word",
        "Recap, a customer quote, and the link again.",
      ],
    ];
    steps.forEach(([d, channel, title, text], i) =>
      s.sequences.push({
        id: ++qid,
        tenant_id: t.id,
        name: seqName,
        step: i + 1,
        day: d,
        when: `Day ${d}`,
        channel,
        title,
        text,
        active: true,
      })
    );
    for (const l of s.leads.filter((x) => x.tenant_id === t.id))
      l.sequence_id = qid - 3;
    const outcomes = [
      "replied",
      "no answer",
      "booked",
      "left voicemail",
      "replied",
      "not now",
    ];
    for (let i = 0; i < 6; i++)
      s.touches.push({
        id: ++tid,
        tenant_id: t.id,
        lead_id: leads[i % leads.length],
        at: day(1 + i * 4 + (ti % 2)),
        channel: ["email", "call", "sms", "call", "email", "instagram"][i],
        note: [
          "Sent the intro and a quote from a regular.",
          "Rang twice, left a voicemail.",
          "They booked a first visit from the text.",
          "Asked to call after the 15th.",
          "Replied with two questions about pricing.",
          "Liked our post, sent a DM.",
        ][i],
        outcome: outcomes[i],
        by_id: staff[1 + (i % 2)],
      });
    // Growth: two campaigns, eight posts, four assets.
    const campaigns: number[] = [];
    [
      [
        "Fall refresh",
        "Bookings",
        400,
        day(1),
        day(30),
        "running",
        "Your Saturday, booked.",
        "Skip the phone. Book in two taps.",
        2.4,
        3.1,
      ],
      [
        "Holiday gift cards",
        "Revenue",
        250,
        day(1, 11),
        day(24, 12),
        "planned",
        "Give an hour of calm.",
        "Gift cards, delivered by email.",
        1.8,
        1.6,
      ],
    ].forEach(
      ([name, goal, budget, starts, ends, status, a, b, ctrA, ctrB]) => {
        s.campaigns.push({
          id: ++caid,
          tenant_id: t.id,
          name,
          goal,
          budget,
          starts,
          ends,
          status,
          variant_a: a,
          variant_b: b,
          ctr_a: ctrA,
          ctr_b: ctrB,
        });
        campaigns.push(caid);
      }
    );
    const postStatus = [
      "posted",
      "posted",
      "posted",
      "scheduled",
      "scheduled",
      "drafted",
      "drafted",
      "idea",
    ];
    const titles = [
      "Meet the team",
      "Before / after",
      "This week's opening",
      "Customer story",
      "Behind the counter",
      "How to book",
      "Weekend special",
      "Thank you, neighbors",
    ];
    for (let i = 0; i < 8; i++)
      s.posts.push({
        id: ++poid,
        tenant_id: t.id,
        campaign_id: campaigns[i % 2],
        date: i < 7 ? day(3 + i * 4 - (ti % 2)) : day(2, 10),
        channel: CHANNELS[(i + ti) % CHANNELS.length],
        title: titles[(i + ti) % titles.length],
        text: `${t.tagline} ${["Book online in two taps.", "Limited slots this week.", "Tag a friend who needs this.", "Link in bio."][i % 4]}`,
        tags: `#${t.business_type} #${t.city.toLowerCase()} #booknow`,
        status: postStatus[i],
        format: ["square", "story", "landscape"][i % 3],
      });
    [
      ["Logo", "logo", "brand, print", "site, posts"],
      ["Storefront", "image", "hero, instagram", "site/home"],
      ["Team photo", "image", "about, facebook", "posts"],
      ["Tagline copy", "copy", "voice", "ads"],
    ].forEach(([name, kind, tags, used]) =>
      s.assets.push({
        id: ++aid,
        tenant_id: t.id,
        name,
        kind,
        url: thumb(tone, String(name)[0]),
        tags,
        used_in: used,
      })
    );
  });
  return s;
}

// ----- schema ----------------------------------------------------------------

const col = (
  name: string,
  type: string,
  extra: Record<string, unknown> = {}
) => ({
  name,
  type,
  ...extra,
});
const id = () => col("id", "number", { required: true, unique: true });
const tenantRef = () =>
  col("tenant_id", "ref", { ref: "tenants", required: true });

export function saasSchema(): Record<string, unknown> {
  return {
    tables: [
      {
        name: "tenants",
        display: "name",
        description:
          "One row per business on the platform. brand_* colors theme that tenant's customer app; business_type shows trade-specific menu items.",
        columns: [
          id(),
          col("name", "string", { required: true }),
          col("slug", "string", { required: true, unique: true }),
          col("business_type", "string", {
            required: true,
            description: "salon, restaurant, contractor, clinic or retail",
          }),
          col("tagline", "string"),
          col("brand_primary", "string"),
          col("brand_accent", "string"),
          col("brand_accent2", "string"),
          col("city", "string"),
          col("phone", "string"),
          col("plan", "string", { default: "Starter" }),
        ],
      },
      {
        name: "roles",
        description:
          "Access levels; a menu item or block with a required role hides from lower levels.",
        columns: [
          id(),
          col("name", "string", { required: true, unique: true }),
          col("level", "number", { required: true, default: 1 }),
          col("description", "string"),
        ],
      },
      {
        name: "permissions",
        description: "What each role may edit, per area of the admin app.",
        columns: [
          id(),
          col("role_id", "ref", { ref: "roles", required: true }),
          col("area", "string", { required: true }),
          col("can_edit", "boolean", { default: false }),
        ],
      },
      {
        name: "users",
        display: "name",
        description: "Team members of a tenant.",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("email", "string", { required: true }),
          col("role_id", "ref", { ref: "roles", required: true }),
          col("avatar", "image"),
          col("active", "boolean", { default: true }),
          col("joined", "date"),
        ],
      },
      {
        name: "menu_items",
        display: "label",
        description:
          "Navigation for the apps. app picks the app; category groups the side menu; required_role and business_type gate rows.",
        columns: [
          id(),
          col("label", "string", { required: true }),
          col("href", "string", { required: true }),
          col("icon", "string"),
          col("category", "string"),
          col("app", "string", { required: true }),
          col("sort", "number", { default: 0 }),
          col("parent_id", "ref", { ref: "menu_items" }),
          col("required_role", "ref", { ref: "roles" }),
          col("business_type", "string"),
        ],
      },
      {
        name: "customers",
        display: "name",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("email", "string"),
          col("phone", "string"),
          col("since", "date"),
          col("visits", "number", { default: 0 }),
          col("tags", "string"),
          col("vip", "boolean", { default: false }),
        ],
      },
      {
        name: "services",
        display: "name",
        description:
          "What a tenant sells or books: services, tables, jobs, appointments, products.",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("category", "string"),
          col("price", "number", { default: 0 }),
          col("minutes", "number", { default: 30 }),
          col("active", "boolean", { default: true }),
          col("image", "image"),
        ],
      },
      {
        name: "bookings",
        display: "date",
        columns: [
          id(),
          tenantRef(),
          col("customer_id", "ref", { ref: "customers", required: true }),
          col("service_id", "ref", { ref: "services", required: true }),
          col("staff_id", "ref", { ref: "users" }),
          col("date", "date", { required: true }),
          col("time", "string"),
          col("status", "string", {
            default: "booked",
            description: "booked, confirmed, done or cancelled",
          }),
          col("notes", "string"),
        ],
      },
      {
        name: "invoices",
        display: "number",
        columns: [
          id(),
          tenantRef(),
          col("customer_id", "ref", { ref: "customers", required: true }),
          col("booking_id", "ref", { ref: "bookings" }),
          col("number", "string", { required: true }),
          col("amount", "number", { required: true }),
          col("status", "string", {
            default: "draft",
            description: "draft, sent, paid or overdue",
          }),
          col("issued", "date"),
          col("due", "date"),
        ],
      },
      {
        name: "leads",
        display: "business",
        description:
          "Outreach pipeline. stage moves New → Contacted → Qualified → Won / Lost.",
        columns: [
          id(),
          tenantRef(),
          col("business", "string", { required: true }),
          col("contact", "string"),
          col("email", "string"),
          col("phone", "string"),
          col("stage", "string", { default: "New" }),
          col("source", "string"),
          col("value", "number", { default: 0 }),
          col("owner_id", "ref", { ref: "users" }),
          col("next_step", "string"),
          col("sequence_id", "ref", { ref: "sequences" }),
        ],
      },
      {
        name: "sequences",
        display: "title",
        description:
          "Outreach sequences, one row per step (day offset, channel, copy).",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("step", "number", { required: true }),
          col("day", "number", { default: 0 }),
          col("when", "string"),
          col("channel", "string"),
          col("title", "string"),
          col("text", "string"),
          col("active", "boolean", { default: true }),
        ],
      },
      {
        name: "touches",
        display: "outcome",
        description:
          "Every contact with a lead: when, which channel, what happened.",
        columns: [
          id(),
          tenantRef(),
          col("lead_id", "ref", { ref: "leads", required: true }),
          col("at", "date", { required: true }),
          col("channel", "string"),
          col("note", "string"),
          col("outcome", "string"),
          col("by_id", "ref", { ref: "users" }),
        ],
      },
      {
        name: "posts",
        display: "title",
        description:
          "Social posts on the content calendar. status: idea, drafted, scheduled, posted.",
        columns: [
          id(),
          tenantRef(),
          col("campaign_id", "ref", { ref: "campaigns" }),
          col("date", "date", { required: true }),
          col("channel", "string"),
          col("title", "string", { required: true }),
          col("text", "string"),
          col("tags", "string"),
          col("status", "string", { default: "idea" }),
          col("format", "string", { default: "square" }),
        ],
      },
      {
        name: "campaigns",
        display: "name",
        description:
          "Paid campaigns with an A/B pair of creatives and their click-through rates.",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("goal", "string"),
          col("budget", "number", { default: 0 }),
          col("starts", "date"),
          col("ends", "date"),
          col("status", "string", { default: "planned" }),
          col("variant_a", "string"),
          col("variant_b", "string"),
          col("ctr_a", "number"),
          col("ctr_b", "number"),
        ],
      },
      {
        name: "assets",
        display: "name",
        description: "Brand assets: logos, photos, copy.",
        columns: [
          id(),
          tenantRef(),
          col("name", "string", { required: true }),
          col("kind", "string"),
          col("url", "image"),
          col("tags", "string"),
          col("used_in", "string"),
        ],
      },
    ],
  };
}

// ----- pages -----------------------------------------------------------------

type Block = Record<string, unknown>;
const T = "tenant_id=@tenant";

const block = (
  id: string,
  name: string,
  span: number,
  props: Block = {},
  extra: Block = {}
): Block => ({
  id,
  name,
  span,
  props,
  ...extra,
});
const bound = (
  id: string,
  name: string,
  span: number,
  props: Block,
  table: string,
  fields: string[],
  extra: {
    filter?: string;
    order?: string;
    mode?: "write";
    variant?: string;
    children?: Block[];
  } = {}
): Block => {
  const { variant, children, ...b } = extra;
  return {
    id,
    name,
    span,
    ...(variant ? { variant } : {}),
    props,
    bindings: [{ table, fields, ...b }],
    ...(children ? { children } : {}),
  };
};
const stat = (
  id: string,
  label: string,
  table: string,
  filter: string,
  props: Block = {}
) => bound(id, "Stat", 3, { label, ...props }, table, [], { filter });
const grid = (id: string, columns: number, children: Block[], span = 12) =>
  block(id, "Grid", span, { columns, gap: "4" }, { children });

const CUSTOMER_TABS = (active: string) => ({
  items: [
    {
      label: "Home",
      icon: "home",
      href: "#/apps/customer/home",
      active: active === "home",
    },
    {
      label: "Book",
      icon: "calendar",
      href: "#/apps/customer/book",
      active: active === "book",
    },
    {
      label: "Bookings",
      icon: "list",
      href: "#/apps/customer/bookings",
      active: active === "bookings",
    },
    {
      label: "Profile",
      icon: "user",
      href: "#/apps/customer/profile",
      active: active === "profile",
    },
  ],
  fixed: true,
});

function customerPage(
  name: string,
  title: string,
  description: string,
  blocks: Block[],
  links: Block[] = []
) {
  return json({
    name: `apps/customer/${name}`,
    title,
    route: `/apps/customer/${name}`,
    description,
    device: "mobile",
    texture: "none",
    padBottom: true,
    layout: { columns: 12, gap: "4", maxWidth: "480px" },
    components: [
      bound("tenant", "TenantSwitcher", 12, { label: "" }, "tenants", [
        "name",
        "brand_primary",
        "brand_accent",
        "business_type",
      ]),
      ...blocks,
      block("tabs", "TabBar", 12, CUSTOMER_TABS(name)),
    ],
    links,
    bindings: [
      {
        table: "tenants",
        fields: [
          "brand_primary",
          "brand_accent",
          "brand_accent2",
          "business_type",
        ],
        filter: "id=@tenant",
      },
    ],
  });
}

function customerPages(): FileMap {
  return {
    "pages/apps/customer/home.json": customerPage(
      "home",
      "Customer: Home",
      "Mobile customer app: what you can book, in the tenant's colors.",
      [
        block(
          "hero",
          "Hero",
          12,
          {
            eyebrow: "Welcome back",
            title: "Book in two taps",
            subtitle: "Pick a service, pick a time. We text you a reminder.",
            ctaLabel: "Book now",
            ctaHref: "#/apps/customer/book",
            secondaryLabel: "",
            gradient: true,
          },
          { variant: "compact" }
        ),
        grid("kpis", 2, [
          bound(
            "upcoming",
            "Stat",
            6,
            { label: "Upcoming", delta: "booked" },
            "bookings",
            ["status"],
            { filter: `${T} status=booked` }
          ),
          bound(
            "visits",
            "Stat",
            6,
            { label: "Visits", delta: "all time", trend: "up" },
            "bookings",
            ["status"],
            { filter: `${T} status=done` }
          ),
        ]),
        block(
          "services-title",
          "Section",
          12,
          {
            kicker: "Services",
            title: "What we offer",
            text: "Tap one to book it.",
            columns: 1,
          },
          {
            children: [
              bound(
                "services",
                "List",
                12,
                {
                  titleField: "name",
                  subtitleField: "category",
                  metaField: "price",
                  imageField: "image",
                },
                "services",
                ["name", "category", "price", "image", "active"],
                {
                  filter: `${T} active=true`,
                  order: "category",
                }
              ),
            ],
          }
        ),
      ],
      [{ to: "apps/customer/book", label: "Book now", from: "hero" }]
    ),
    "pages/apps/customer/book.json": customerPage(
      "book",
      "Customer: Book",
      "Pick a day on the calendar and send a booking into the bookings table.",
      [
        block("header", "PageHeader", 12, {
          title: "Book a visit",
          subtitle: "Busy days are marked.",
        }),
        bound(
          "calendar",
          "Calendar",
          12,
          { dateField: "date", titleField: "time", toneField: "status" },
          "bookings",
          ["date", "time", "status"],
          { filter: T, variant: "compact" }
        ),
        bound(
          "form",
          "Form",
          12,
          { title: "Your booking", text: "", submitLabel: "Book" },
          "bookings",
          ["service_id", "date", "time", "notes"],
          { mode: "write" }
        ),
      ],
      [{ to: "apps/customer/bookings", label: "See bookings", from: "form" }]
    ),
    "pages/apps/customer/bookings.json": customerPage(
      "bookings",
      "Customer: Bookings",
      "Past and upcoming bookings with their status.",
      [
        block("header", "PageHeader", 12, {
          title: "Your bookings",
          subtitle: "Newest first",
        }),
        bound(
          "list",
          "Table",
          12,
          { caption: "" },
          "bookings",
          ["date", "time", "service_id", "status"],
          { filter: T, order: "-date", variant: "striped" }
        ),
        block("empty", "EmptyState", 12, {
          icon: "calendar",
          title: "Need another slot?",
          text: "Book again in two taps.",
          ctaLabel: "Book",
          ctaHref: "#/apps/customer/book",
        }),
      ]
    ),
    "pages/apps/customer/profile.json": customerPage(
      "profile",
      "Customer: Profile",
      "Invoices and the viewer's role.",
      [
        block("header", "PageHeader", 12, {
          title: "Profile",
          subtitle: "Receipts and settings",
        }),
        block("avatar", "Avatar", 12, {
          name: "Sam Customer",
          size: "lg",
          ring: true,
        }),
        bound(
          "invoices",
          "Table",
          12,
          { caption: "Invoices" },
          "invoices",
          ["number", "amount", "status", "due"],
          { filter: T, order: "-issued" }
        ),
        bound("role", "RoleSwitcher", 12, { label: "Viewing as" }, "roles", [
          "name",
          "level",
        ]),
      ]
    ),
  };
}

const sidebar = (): Block =>
  bound(
    "sidebar",
    "Sidebar",
    3,
    { brand: "Paper admin", labelField: "label", groupField: "category" },
    "menu_items",
    [
      "label",
      "href",
      "icon",
      "category",
      "app",
      "required_role",
      "business_type",
    ],
    {
      filter: "app=admin",
      order: "sort",
      children: [
        bound(
          "tenant",
          "TenantSwitcher",
          12,
          { label: "Business" },
          "tenants",
          ["name", "business_type", "brand_primary"]
        ),
        bound("role", "RoleSwitcher", 12, { label: "Viewing as" }, "roles", [
          "name",
          "level",
        ]),
      ],
    }
  );

function adminPage(
  name: string,
  title: string,
  subtitle: string,
  description: string,
  blocks: Block[],
  links: Block[] = []
) {
  return json({
    name: `apps/admin/${name}`,
    title: `Admin: ${title}`,
    route: `/apps/admin/${name}`,
    description,
    device: "desktop",
    layout: { columns: 12, gap: "4", maxWidth: "1440px" },
    components: [
      sidebar(),
      block(
        "main",
        "Grid",
        9,
        { columns: 1, gap: "4" },
        {
          children: [
            block("header", "PageHeader", 12, { title, subtitle }),
            ...blocks,
          ],
        }
      ),
    ],
    links,
    bindings: [
      { table: "roles", fields: ["name", "level"] },
      {
        table: "tenants",
        fields: ["business_type", "brand_primary"],
        filter: "id=@tenant",
      },
    ],
  });
}

function adminPages(): FileMap {
  return {
    "pages/apps/admin/dashboard.json": adminPage(
      "dashboard",
      "Dashboard",
      "Today across the business.",
      "Back office home: key figures, bookings by status, invoices by status, the month, recent bookings.",
      [
        grid("kpis", 4, [
          stat("k-customers", "Customers", "customers", T),
          stat("k-booked", "Booked", "bookings", `${T} status=booked`, {
            trend: "up",
            delta: "upcoming",
          }),
          stat("k-open", "Open invoices", "invoices", `${T} status!=paid`, {
            delta: "not paid yet",
          }),
          bound(
            "k-leads",
            "Stat",
            3,
            { label: "Leads in play" },
            "leads",
            ["stage"],
            { filter: `${T} stage!=Won stage!=Lost`, variant: "primary" }
          ),
        ]),
        grid("charts", 2, [
          bound(
            "bookings-chart",
            "Chart",
            6,
            { title: "Bookings by status", xField: "status", height: 180 },
            "bookings",
            ["status"],
            { filter: T }
          ),
          bound(
            "invoices-chart",
            "Chart",
            6,
            {
              title: "Invoiced by status",
              xField: "status",
              yField: "amount",
              format: "currency",
              height: 180,
            },
            "invoices",
            ["status", "amount"],
            { filter: T }
          ),
        ]),
        bound(
          "calendar",
          "Calendar",
          12,
          { dateField: "date", titleField: "time", toneField: "status" },
          "bookings",
          ["date", "time", "status"],
          { filter: T }
        ),
        bound(
          "recent",
          "Table",
          12,
          { caption: "Recent bookings", maxHeight: "320px" },
          "bookings",
          ["date", "time", "customer_id", "service_id", "staff_id", "status"],
          { filter: T, order: "-date" }
        ),
      ],
      [
        { to: "apps/admin/bookings", label: "Bookings", from: "sidebar" },
        { to: "apps/admin/customers", label: "Customers", from: "sidebar" },
        { to: "apps/admin/invoices", label: "Invoices", from: "sidebar" },
      ]
    ),
    "pages/apps/admin/customers.json": adminPage(
      "customers",
      "Customers",
      "Everyone who booked, and a form to add one.",
      "Customer list with a form generated from the customers schema and a visits chart.",
      [
        bound(
          "customers",
          "Table",
          12,
          { caption: "Customers" },
          "customers",
          ["name", "email", "phone", "since", "visits", "vip"],
          { filter: T, order: "-visits", variant: "striped" }
        ),
        grid("row", 2, [
          bound(
            "new-customer",
            "Form",
            6,
            {
              title: "New customer",
              text: "Saved to the customers table.",
              submitLabel: "Add customer",
            },
            "customers",
            ["name", "email", "phone", "vip"],
            { mode: "write" }
          ),
          bound(
            "visits",
            "Chart",
            6,
            {
              title: "Visits per customer",
              xField: "name",
              yField: "visits",
              height: 220,
            },
            "customers",
            ["name", "visits"],
            { filter: T }
          ),
        ]),
      ]
    ),
    "pages/apps/admin/bookings.json": adminPage(
      "bookings",
      "Bookings",
      "The pipeline of visits: booked, confirmed, done.",
      "Kanban of bookings by status, the month calendar and a booking form.",
      [
        bound(
          "kanban",
          "Kanban",
          12,
          {
            stageField: "status",
            stages: ["booked", "confirmed", "done", "cancelled"],
            titleField: "time",
            subtitleField: "date",
            metaField: "notes",
          },
          "bookings",
          ["status", "time", "date", "notes"],
          { filter: T, order: "date" }
        ),
        grid("row", 2, [
          bound(
            "calendar",
            "Calendar",
            6,
            { dateField: "date", titleField: "time", toneField: "status" },
            "bookings",
            ["date", "time", "status"],
            { filter: T, variant: "compact" }
          ),
          bound(
            "new-booking",
            "Form",
            6,
            { title: "New booking", text: "", submitLabel: "Book" },
            "bookings",
            ["customer_id", "service_id", "staff_id", "date", "time"],
            { mode: "write" }
          ),
        ]),
      ]
    ),
    "pages/apps/admin/invoices.json": adminPage(
      "invoices",
      "Invoices",
      "Money in, money owed.",
      "Invoice figures, the list, a form and the amount by status.",
      [
        grid("kpis", 3, [
          bound("paid", "Stat", 4, { label: "Paid" }, "invoices", ["status"], {
            filter: `${T} status=paid`,
            variant: "primary",
          }),
          bound("sent", "Stat", 4, { label: "Sent" }, "invoices", ["status"], {
            filter: `${T} status=sent`,
          }),
          bound(
            "overdue",
            "Stat",
            4,
            { label: "Overdue", trend: "down" },
            "invoices",
            ["status"],
            { filter: `${T} status=overdue` }
          ),
        ]),
        bound(
          "invoices",
          "Table",
          12,
          { caption: "Invoices" },
          "invoices",
          ["number", "customer_id", "amount", "status", "issued", "due"],
          { filter: T, order: "-issued" }
        ),
        grid("row", 2, [
          bound(
            "new-invoice",
            "Form",
            6,
            { title: "New invoice", text: "", submitLabel: "Create" },
            "invoices",
            ["customer_id", "number", "amount", "status", "due"],
            { mode: "write" }
          ),
          bound(
            "amounts",
            "Chart",
            6,
            {
              title: "Amount by status",
              xField: "status",
              yField: "amount",
              format: "currency",
              height: 220,
            },
            "invoices",
            ["status", "amount"],
            { filter: T }
          ),
        ]),
      ]
    ),
    "pages/apps/admin/team.json": adminPage(
      "team",
      "Team",
      "Who works here and what each role may do.",
      "Team table; owners get the form to add people; the permissions matrix.",
      [
        bound(
          "team",
          "Table",
          12,
          { caption: "Team" },
          "users",
          ["avatar", "name", "email", "role_id", "active", "joined"],
          { filter: T }
        ),
        block(
          "gate",
          "RoleGate",
          12,
          { role: "owner", message: "Only owners add or remove team members." },
          {
            children: [
              bound(
                "new-user",
                "Form",
                12,
                { title: "Add a team member", text: "", submitLabel: "Add" },
                "users",
                ["name", "email", "role_id", "active"],
                { mode: "write" }
              ),
            ],
          }
        ),
        bound(
          "permissions",
          "Table",
          12,
          { caption: "Permissions" },
          "permissions",
          ["role_id", "area", "can_edit"],
          { order: "-role_id" }
        ),
      ]
    ),
    "pages/apps/admin/settings.json": adminPage(
      "settings",
      "Settings",
      "This business and its menus.",
      "Owner-only: the tenant row (brand colors, plan) and the admin menu items.",
      [
        block(
          "gate",
          "RoleGate",
          12,
          {
            role: "owner",
            message:
              "Settings are for owners. Switch the role above to see them.",
          },
          {
            children: [
              bound(
                "tenant-row",
                "Table",
                12,
                { caption: "This business" },
                "tenants",
                [
                  "name",
                  "slug",
                  "business_type",
                  "plan",
                  "brand_primary",
                  "brand_accent",
                  "city",
                  "phone",
                ],
                { filter: "id=@tenant" }
              ),
              bound(
                "menus",
                "Table",
                12,
                { caption: "Admin menu" },
                "menu_items",
                [
                  "label",
                  "href",
                  "category",
                  "required_role",
                  "business_type",
                  "sort",
                ],
                { filter: "app=admin", order: "sort" }
              ),
            ],
          }
        ),
      ]
    ),
  };
}

const SITE_NAV = [
  { label: "Features", href: "#/site/home" },
  { label: "Pricing", href: "#/site/pricing" },
  { label: "Customer app", href: "#/apps/customer/home" },
  { label: "Admin", href: "#/apps/admin/dashboard" },
];
const siteTop = () =>
  block(
    "nav",
    "Topbar",
    12,
    { brand: "Paper", items: SITE_NAV, sticky: false },
    {
      children: [
        block("nav-cta", "Button", 12, {
          label: "Start free",
          href: "#/site/pricing",
          size: "sm",
        }),
      ],
    }
  );
const siteFooter = () =>
  block("footer", "Footer", 12, {
    brand: "Paper",
    tagline: "The calm back office for small businesses.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Customer app", href: "#/apps/customer/home" },
          { label: "Admin", href: "#/apps/admin/dashboard" },
          { label: "Pricing", href: "#/site/pricing" },
        ],
      },
      {
        title: "Growth",
        links: [
          { label: "Social", href: "#/growth/social/calendar" },
          { label: "Ads", href: "#/growth/social/ads" },
          { label: "Outreach", href: "#/growth/outreach/leads" },
        ],
      },
      {
        title: "Trades",
        links: TENANTS.map((t) => ({
          label: t.business_type[0].toUpperCase() + t.business_type.slice(1),
          href: `#/apps/customer/home?tenant=${t.id}`,
        })),
      },
    ],
    copyright: "© 2026 Paper. Built with PaperOS.",
  });

function sitePages(): FileMap {
  return {
    "pages/site/home.json": json({
      name: "site/home",
      title: "Site: Home",
      route: "/site/home",
      description:
        "Marketing site of the SaaS: hero, features, live figures from the platform tables, customers, FAQ.",
      texture: "dots",
      layout: { columns: 12, gap: "5", maxWidth: "1200px" },
      components: [
        siteTop(),
        block("hero", "Hero", 12, {
          eyebrow: "For salons, restaurants, contractors, clinics and shops",
          title: "The calm back office for small businesses",
          subtitle:
            "Bookings, customers, invoices and growth in one place, with a customer app in your colors.",
          ctaLabel: "Start free",
          ctaHref: "#/site/pricing",
          secondaryLabel: "See the customer app",
          secondaryHref: "#/apps/customer/home",
          note: "No card needed. Five businesses already run on this demo.",
        }),
        block(
          "features",
          "Section",
          12,
          {
            kicker: "Everything you need",
            title: "Run the day, grow the week",
            text: "Four apps over one data model.",
            columns: 3,
          },
          {
            children: [
              block("f1", "Card", 4, {
                icon: "calendar",
                kicker: "Operate",
                title: "Bookings and invoices",
                text: "A calendar, a pipeline and money in, all from the same tables.",
              }),
              block("f2", "Card", 4, {
                icon: "user",
                kicker: "Customers",
                title: "An app in your colors",
                text: "Customers book in two taps on their phone. Your brand, your services.",
              }),
              block("f3", "Card", 4, {
                icon: "sparkles",
                kicker: "Grow",
                title: "Social, ads and outreach",
                text: "Post templates, a content calendar, ad A/B tests and a lead pipeline.",
              }),
            ],
          }
        ),
        grid("figures", 3, [
          bound(
            "n-businesses",
            "Stat",
            4,
            { label: "Businesses", delta: "on the platform" },
            "tenants",
            []
          ),
          bound(
            "n-bookings",
            "Stat",
            4,
            { label: "Bookings taken", trend: "up" },
            "bookings",
            []
          ),
          bound(
            "n-paid",
            "Stat",
            4,
            { label: "Invoices paid" },
            "invoices",
            ["status"],
            { filter: "status=paid", variant: "primary" }
          ),
        ]),
        block(
          "customers",
          "Section",
          12,
          {
            kicker: "Customers",
            title: "Built for your trade",
            text: "Every business gets its own menus and colors.",
            columns: 1,
          },
          {
            children: [
              bound(
                "tenants",
                "List",
                12,
                {
                  titleField: "name",
                  subtitleField: "tagline",
                  metaField: "business_type",
                },
                "tenants",
                ["name", "tagline", "business_type"],
                { order: "name" }
              ),
            ],
          }
        ),
        block("quotes", "Testimonial", 12, {
          items: [
            {
              quote:
                "We stopped losing bookings to voicemail. The app just fills the quiet hours.",
              name: "Maya",
              role: "Bloom Salon",
              stars: 5,
            },
            {
              quote: "One place for tables, takeout and the Friday newsletter.",
              name: "Omar",
              role: "Ember & Oak",
              stars: 5,
            },
            {
              quote:
                "Estimates go out the same day. Invoices follow themselves.",
              name: "Theo",
              role: "Northline Contracting",
              stars: 4,
            },
          ],
        }),
        block("faq", "FAQ", 12, {
          items: [
            {
              q: "Do my customers need an account?",
              a: "No. They book from a link; the app remembers them on their phone.",
            },
            {
              q: "Can my staff see everything?",
              a: "Roles decide. Owners see billing and the team; staff see their schedule and customers.",
            },
            {
              q: "Where does the data live?",
              a: "In tables you can open: data/*.json in this project, editable from the Data window.",
            },
          ],
        }),
        siteFooter(),
      ],
      links: [
        { to: "site/pricing", label: "Start free", from: "hero" },
        {
          to: "apps/customer/home",
          label: "See the customer app",
          from: "hero",
        },
      ],
      bindings: [],
    }),
    "pages/site/pricing.json": json({
      name: "site/pricing",
      title: "Site: Pricing",
      route: "/site/pricing",
      description:
        "Plans, with the plan split of the businesses on the platform.",
      texture: "dots",
      layout: { columns: 12, gap: "5", maxWidth: "1200px" },
      components: [
        siteTop(),
        block("header", "PageHeader", 12, {
          title: "Pricing",
          subtitle: "Start free. Grow when the calendar fills.",
        }),
        block("plans", "Pricing", 12, {
          plans: [
            {
              name: "Starter",
              price: "$0",
              period: "forever",
              description: "One location, the customer app, bookings.",
              features: [
                "Customer app",
                "Bookings calendar",
                "Up to 200 customers",
              ],
              cta: "Start free",
              href: "#/apps/customer/home",
            },
            {
              name: "Growth",
              price: "$29",
              period: "/ month",
              description: "Invoices, growth tools, three team seats.",
              features: [
                "Everything in Starter",
                "Invoices",
                "Social calendar and ads",
                "Outreach CRM",
              ],
              cta: "Try Growth",
              href: "#/apps/admin/dashboard",
              featured: true,
              flag: "Most popular",
            },
            {
              name: "Pro",
              price: "$79",
              period: "/ month",
              description: "Unlimited team, roles and permissions.",
              features: [
                "Everything in Growth",
                "Roles and permissions",
                "Priority support",
              ],
              cta: "Talk to us",
              href: "#/growth/outreach/leads",
            },
          ],
        }),
        bound(
          "plan-split",
          "Chart",
          12,
          { title: "Businesses per plan", xField: "plan", height: 160 },
          "tenants",
          ["plan"]
        ),
        block("faq", "FAQ", 12, {
          items: [
            {
              q: "Can I switch plans?",
              a: "Any time; the change applies to the next invoice.",
            },
            { q: "Is there a contract?", a: "No. Monthly, cancel whenever." },
          ],
        }),
        siteFooter(),
      ],
      links: [{ to: "site/home", label: "Features", from: "nav" }],
      bindings: [],
    }),
  };
}

const GROWTH_NAV = [
  { label: "Calendar", href: "#/growth/social/calendar" },
  { label: "Posts", href: "#/growth/social/posts" },
  { label: "Ads", href: "#/growth/social/ads" },
  { label: "Assets", href: "#/growth/social/assets" },
  { label: "Leads", href: "#/growth/outreach/leads" },
  { label: "Sequences", href: "#/growth/outreach/sequences" },
  { label: "Touches", href: "#/growth/outreach/touches" },
  { label: "Calls", href: "#/growth/outreach/calls" },
];

function growthPage(
  name: string,
  title: string,
  subtitle: string,
  description: string,
  blocks: Block[],
  links: Block[] = []
) {
  return json({
    name: `growth/${name}`,
    title,
    route: `/growth/${name}`,
    description,
    device: "desktop",
    layout: { columns: 12, gap: "4", maxWidth: "1400px" },
    components: [
      block(
        "nav",
        "Topbar",
        12,
        {
          brand: "Growth",
          brandHref: "#/growth/social/calendar",
          items: GROWTH_NAV,
          sticky: false,
        },
        {
          children: [
            bound("tenant", "TenantSwitcher", 12, { label: "" }, "tenants", [
              "name",
              "brand_primary",
            ]),
          ],
        }
      ),
      block("header", "PageHeader", 12, { title, subtitle }),
      ...blocks,
    ],
    links,
    bindings: [
      {
        table: "tenants",
        fields: ["brand_primary", "brand_accent"],
        filter: "id=@tenant",
      },
    ],
  });
}

function growthPages(): FileMap {
  return {
    "pages/growth/social/calendar.json": growthPage(
      "social/calendar",
      "Social: Calendar",
      "What goes out when, and what is still an idea.",
      "Content calendar of the posts table and a kanban by status.",
      [
        bound(
          "calendar",
          "Calendar",
          12,
          { dateField: "date", titleField: "title", toneField: "channel" },
          "posts",
          ["date", "title", "channel"],
          { filter: T }
        ),
        bound(
          "pipeline",
          "Kanban",
          12,
          {
            stageField: "status",
            stages: ["idea", "drafted", "scheduled", "posted"],
            titleField: "title",
            subtitleField: "channel",
            metaField: "date",
          },
          "posts",
          ["status", "title", "channel", "date"],
          { filter: T, order: "date" }
        ),
      ],
      [{ to: "growth/social/posts", label: "Templates", from: "nav" }]
    ),
    "pages/growth/social/posts.json": growthPage(
      "social/posts",
      "Social: Post templates",
      "Three formats, one brand. The table below is the plan.",
      "PostCard templates in square, story and landscape formats, the posts table and a form to add a post.",
      [
        grid("templates", 3, [
          block("p-square", "PostCard", 4, {
            brand: "Bloom Salon",
            handle: "@bloomsalon",
            kicker: "This week",
            title: "20% off color, Tuesday to Thursday",
            text: "Book online in two taps. Limited slots.",
            tags: "#salon #color #booknow",
            cta: "Book now",
            format: "square",
          }),
          block("p-story", "PostCard", 4, {
            brand: "Ember & Oak",
            handle: "@emberandoak",
            kicker: "Tonight",
            title: "Wood-fired specials",
            text: "Two seatings left. Tap to reserve.",
            tags: "#dinner #austin",
            cta: "Reserve",
            format: "story",
          }),
          block("p-wide", "PostCard", 4, {
            brand: "Northline Contracting",
            handle: "@northline",
            kicker: "Before / after",
            title: "A kitchen in nine days",
            text: "Same-day estimates this month.",
            tags: "#remodel #kitchen",
            cta: "Get an estimate",
            format: "landscape",
          }),
        ]),
        bound(
          "posts",
          "Table",
          12,
          { caption: "Posts" },
          "posts",
          ["date", "channel", "title", "status", "format", "tags"],
          { filter: T, order: "-date", variant: "striped" }
        ),
        bound(
          "new-post",
          "Form",
          12,
          { title: "Plan a post", text: "", submitLabel: "Add to calendar" },
          "posts",
          ["date", "channel", "title", "text", "status", "format"],
          { mode: "write" }
        ),
      ]
    ),
    "pages/growth/social/ads.json": growthPage(
      "social/ads",
      "Social: Ads",
      "Two creatives per campaign; the table keeps the click-through rates.",
      "Ad A/B cards, the campaigns table and budget per campaign.",
      [
        grid("ab", 2, [
          block("ad-a", "AdCard", 6, {
            tag: "A",
            channel: "Instagram",
            imageText: "Your Saturday, booked.",
            imageTone: "gradient",
            headline: "Online booking for small businesses",
            body: "Fill quiet hours with a link your customers already have.",
            cta: "Try free",
            metrics: "CTR 2.4% · CPC $0.62",
          }),
          block("ad-b", "AdCard", 6, {
            tag: "B",
            channel: "Instagram",
            imageText: "Skip the phone.",
            imageTone: "dark",
            headline: "Book in two taps",
            body: "Reminders by text, receipts by email, no app store.",
            cta: "Try free",
            metrics: "CTR 3.1% · CPC $0.48",
          }),
        ]),
        bound(
          "campaigns",
          "Table",
          12,
          { caption: "Campaigns" },
          "campaigns",
          [
            "name",
            "goal",
            "budget",
            "starts",
            "ends",
            "status",
            "ctr_a",
            "ctr_b",
          ],
          { filter: T }
        ),
        bound(
          "budget",
          "Chart",
          12,
          {
            title: "Budget per campaign",
            xField: "name",
            yField: "budget",
            format: "currency",
            height: 180,
          },
          "campaigns",
          ["name", "budget"],
          { filter: T }
        ),
      ]
    ),
    "pages/growth/social/assets.json": growthPage(
      "social/assets",
      "Social: Assets",
      "Logos, photos and copy, tagged by where they are used.",
      "Asset list with thumbnails, the table and an upload form.",
      [
        grid("row", 2, [
          bound(
            "assets",
            "List",
            6,
            {
              titleField: "name",
              subtitleField: "kind",
              metaField: "tags",
              imageField: "url",
            },
            "assets",
            ["name", "kind", "tags", "url"],
            { filter: T }
          ),
          bound(
            "new-asset",
            "Form",
            6,
            { title: "Add an asset", text: "", submitLabel: "Add" },
            "assets",
            ["name", "kind", "url", "tags"],
            { mode: "write" }
          ),
        ]),
        bound(
          "table",
          "Table",
          12,
          { caption: "Assets" },
          "assets",
          ["name", "kind", "tags", "used_in"],
          { filter: T }
        ),
      ]
    ),
    "pages/growth/outreach/leads.json": growthPage(
      "outreach/leads",
      "Outreach: Leads",
      "The pipeline. Drag is coming; for now, edit the stage in the Data window.",
      "Lead figures, the kanban by stage and a form to add a lead.",
      [
        grid("kpis", 4, [
          stat("k-new", "New", "leads", `${T} stage=New`),
          stat("k-qualified", "Qualified", "leads", `${T} stage=Qualified`, {
            trend: "up",
          }),
          bound("k-won", "Stat", 3, { label: "Won" }, "leads", ["stage"], {
            filter: `${T} stage=Won`,
            variant: "primary",
          }),
          stat("k-lost", "Lost", "leads", `${T} stage=Lost`, { trend: "down" }),
        ]),
        bound(
          "kanban",
          "Kanban",
          12,
          {
            stageField: "stage",
            stages: STAGES,
            titleField: "business",
            subtitleField: "contact",
            metaField: "next_step",
          },
          "leads",
          ["stage", "business", "contact", "next_step", "value"],
          { filter: T, order: "-value" }
        ),
        bound(
          "new-lead",
          "Form",
          12,
          { title: "New lead", text: "", submitLabel: "Add lead" },
          "leads",
          ["business", "contact", "email", "phone", "stage", "source", "value"],
          { mode: "write" }
        ),
      ],
      [{ to: "growth/outreach/sequences", label: "Sequences", from: "nav" }]
    ),
    "pages/growth/outreach/sequences.json": growthPage(
      "outreach/sequences",
      "Outreach: Sequences",
      "Four touches over ten days; edit a step or add one.",
      "Sequence steps as a timeline, the table and a step form.",
      [
        bound(
          "timeline",
          "Timeline",
          12,
          {
            timeField: "when",
            titleField: "title",
            textField: "text",
            channelField: "channel",
          },
          "sequences",
          ["when", "title", "text", "channel", "day"],
          { filter: T, order: "day" }
        ),
        grid("row", 2, [
          bound(
            "steps",
            "Table",
            6,
            { caption: "Steps" },
            "sequences",
            ["name", "step", "day", "channel", "title"],
            { filter: T, order: "step" }
          ),
          bound(
            "new-step",
            "Form",
            6,
            { title: "Add a step", text: "", submitLabel: "Add" },
            "sequences",
            ["name", "step", "day", "channel", "title", "text"],
            { mode: "write" }
          ),
        ]),
      ]
    ),
    "pages/growth/outreach/touches.json": growthPage(
      "outreach/touches",
      "Outreach: Touch log",
      "Every call, text and email, newest first.",
      "Touches as a timeline, the table and a log form.",
      [
        bound(
          "timeline",
          "Timeline",
          12,
          {
            timeField: "at",
            titleField: "outcome",
            textField: "note",
            channelField: "channel",
          },
          "touches",
          ["at", "outcome", "note", "channel"],
          { filter: T, order: "-at", variant: "compact" }
        ),
        grid("row", 2, [
          bound(
            "touches",
            "Table",
            6,
            { caption: "Touches" },
            "touches",
            ["at", "lead_id", "channel", "outcome", "by_id"],
            { filter: T, order: "-at" }
          ),
          bound(
            "log",
            "Form",
            6,
            { title: "Log a touch", text: "", submitLabel: "Log" },
            "touches",
            ["lead_id", "at", "channel", "note", "outcome"],
            { mode: "write" }
          ),
        ]),
      ]
    ),
    "pages/growth/outreach/calls.json": growthPage(
      "outreach/calls",
      "Outreach: Call sheet",
      "Qualified leads, biggest first, with the number and the next step.",
      "Call list from the leads table and the calls already made.",
      [
        grid("kpis", 2, [
          bound(
            "k-calls",
            "Stat",
            6,
            { label: "Calls to make", delta: "qualified leads" },
            "leads",
            ["stage"],
            { filter: `${T} stage=Qualified`, variant: "primary" }
          ),
          stat("k-made", "Calls made", "touches", `${T} channel=call`),
        ]),
        bound(
          "sheet",
          "Table",
          12,
          { caption: "Call sheet" },
          "leads",
          ["business", "contact", "phone", "value", "next_step", "owner_id"],
          {
            filter: `${T} stage=Qualified`,
            order: "-value",
            variant: "striped",
          }
        ),
        bound(
          "made",
          "Table",
          12,
          { caption: "Calls made" },
          "touches",
          ["at", "lead_id", "note", "outcome"],
          { filter: `${T} channel=call`, order: "-at" }
        ),
      ]
    ),
  };
}

// ----- showcase board ----------------------------------------------------------

export function showcaseBoard(): BoardDef {
  const preview = (
    id: string,
    title: string,
    entry: string,
    size?: { w: number; h: number }
  ) => ({
    id,
    kind: "preview",
    title,
    content: entry,
    ...(size ? { size } : {}),
  });
  return {
    name: "showcase",
    title: "Small Business SaaS",
    description:
      "Acquisition, Product and Growth: the marketing site and social posts bring leads, leads become customers who book in the app, bookings become invoices, and paid customers get the next promotion.",
    gap: 240,
    sections: [
      {
        id: "acquisition",
        title: "1. Acquisition: site, social, ads, leads",
        grid: "grid",
        columns: 2,
        cell: { w: 680, h: 480 },
        windows: [
          preview("site-home", "Site: home", "pages/site/home.json"),
          preview(
            "social-calendar",
            "Social: content calendar",
            "pages/growth/social/calendar.json?tenant=1"
          ),
          preview("ads", "Ads: A/B", "pages/growth/social/ads.json?tenant=1"),
          preview(
            "leads",
            "Outreach: leads kanban",
            "pages/growth/outreach/leads.json?tenant=1"
          ),
        ],
        notes:
          "Posts and ads send people to the site; sign-ups land in the leads pipeline.",
      },
      {
        id: "product",
        title: "2. Product: the customer app and the back office",
        grid: "row",
        windows: [
          preview(
            "customer-home",
            "Customer app (Bloom Salon)",
            "pages/apps/customer/home.json?tenant=1",
            { w: 420, h: 820 }
          ),
          preview(
            "customer-book",
            "Customer app (Ember & Oak)",
            "pages/apps/customer/book.json?tenant=2",
            { w: 420, h: 820 }
          ),
          preview(
            "admin-dashboard",
            "Admin: dashboard (manager)",
            "pages/apps/admin/dashboard.json?tenant=1&role=3",
            { w: 1180, h: 820 }
          ),
        ],
        notes:
          "One data model, one tenant's colors: the same page for a salon and a restaurant.",
      },
      {
        id: "growth",
        title: "3. Growth: bookings, invoices, sequences, repeat",
        grid: "grid",
        columns: 2,
        cell: { w: 1000, h: 600 },
        windows: [
          preview(
            "admin-bookings",
            "Admin: bookings pipeline",
            "pages/apps/admin/bookings.json?tenant=1&role=3"
          ),
          preview(
            "admin-invoices",
            "Admin: invoices",
            "pages/apps/admin/invoices.json?tenant=1&role=4"
          ),
          preview(
            "sequences",
            "Outreach: sequence builder",
            "pages/growth/outreach/sequences.json?tenant=1"
          ),
          preview(
            "posts",
            "Social: post templates",
            "pages/growth/social/posts.json?tenant=1"
          ),
        ],
        notes:
          "Done bookings become invoices; paid customers get the next promotion.",
      },
      {
        id: "data",
        title: "4. The tables behind it",
        grid: "grid",
        columns: 2,
        cell: { w: 560, h: 380 },
        windows: [
          { id: "t-leads", kind: "data", content: { table: "leads" } },
          { id: "t-customers", kind: "data", content: { table: "customers" } },
          { id: "t-bookings", kind: "data", content: { table: "bookings" } },
          { id: "t-invoices", kind: "data", content: { table: "invoices" } },
          { id: "t-tenants", kind: "data", content: { table: "tenants" } },
          { id: "t-posts", kind: "data", content: { table: "posts" } },
        ],
        notes:
          "Every window above reads these files. Edit a row and the previews follow.",
      },
    ],
    arrows: [
      {
        from: "social-calendar",
        to: "site-home",
        label: "posts drive visits",
        color: "violet",
      },
      {
        from: "site-home",
        to: "leads",
        label: "sign-ups become leads",
        color: "violet",
      },
      {
        from: "leads",
        to: "customer-home",
        label: "won lead → customer",
        color: "orange",
      },
      {
        from: "customer-book",
        to: "admin-bookings",
        label: "customer → booking",
        color: "orange",
      },
      {
        from: "admin-bookings",
        to: "admin-invoices",
        label: "booking → invoice",
        color: "orange",
      },
      {
        from: "admin-invoices",
        to: "posts",
        label: "paid → repeat & promo",
        color: "green",
      },
      {
        from: "sequences",
        to: "t-leads",
        label: "touches move stages",
        color: "grey",
      },
      { from: "t-leads", to: "t-customers", label: "won" },
      { from: "t-customers", to: "t-bookings", label: "books" },
      { from: "t-bookings", to: "t-invoices", label: "done → invoice" },
      { from: "t-invoices", to: "t-posts", label: "repeat / promo" },
    ],
    steps: [
      {
        section: "acquisition",
        title: "Acquisition",
        caption:
          "The site, the content calendar and the ads bring people in; every sign-up is a lead in the pipeline.",
      },
      {
        section: "product",
        title: "Product",
        caption:
          "Customers book in two taps in an app that wears the tenant's colors; the back office runs the day, gated by role.",
      },
      {
        section: "growth",
        title: "Growth",
        caption:
          "Bookings turn into invoices, sequences and touches move leads, and paid customers get the next promotion.",
      },
      {
        section: "data",
        title: "The data",
        caption:
          "Fifteen tables, five tenants, plain JSON files. Every page above filters by tenant_id=@tenant.",
      },
    ],
  };
}

// ----- the project -------------------------------------------------------------

const README = `# Small Business SaaS

A multi-tenant sample: five businesses (a salon, a restaurant, a contractor,
a clinic and a shop) share one data model and four apps composed as page
sets from the design system.

- \`pages/apps/customer/*\`: the customer app, mobile-first, bottom tab bar,
  in the tenant's brand colors (\`tenants.brand_*\`).
- \`pages/apps/admin/*\`: the back office. The side menu comes from
  \`menu_items\` (grouped, gated by \`required_role\` and \`business_type\`);
  the tenant and role switchers set the preview context.
- \`pages/site/*\`: the marketing site of the SaaS itself.
- \`pages/growth/social/*\`: post templates, content calendar, ad A/B, assets.
- \`pages/growth/outreach/*\`: leads kanban, sequence builder, touch log, call sheet.

Every data-bound block filters by \`tenant_id=@tenant\`. Open a page in the
Preview with \`?tenant=2&role=3\` to pick the business and the viewer's role,
or use the switchers on the page.

Boards: **Boards > Small Business SaaS** tours Acquisition, Product and Growth.
**Boards > Data lineage** shows which table feeds every component on every page.
`;

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Small Business SaaS</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Small Business SaaS</h1>
      <p>This project is made of pages. Pick one in the Preview window's entry list, or open a board from the Boards menu.</p>
      <ul>
        <li><a href="pages/site/home.json">Marketing site</a></li>
        <li><a href="pages/apps/customer/home.json?tenant=1">Customer app (Bloom Salon)</a></li>
        <li><a href="pages/apps/admin/dashboard.json?tenant=1&amp;role=4">Admin dashboard (owner)</a></li>
        <li><a href="pages/growth/outreach/leads.json?tenant=1">Outreach: leads</a></li>
      </ul>
      <p data-source="tenants" data-order="id"><span data-field="name"></span> · </p>
    </main>
  </body>
</html>
`;

const STYLES = `body { margin: 0; font-family: var(--ds-font-sans, system-ui, sans-serif); background: var(--ds-color-bg, #faf8f4); color: var(--ds-color-text, #18181b); }
main { max-width: 640px; margin: 48px auto; padding: 24px; }
h1 { font-family: var(--ds-font-display, inherit); }
a { color: var(--ds-color-primary, #e85d2f); }
`;

/** Every file of the Small Business SaaS project. */
export function saasProjectFiles(): FileMap {
  const seed = saasSeed();
  const files: FileMap = {
    "index.html": INDEX,
    "styles.css": STYLES,
    "README.md": README,
    "data/schema.json": json(saasSchema()),
    ...customerPages(),
    ...adminPages(),
    ...sitePages(),
    ...growthPages(),
    "boards/showcase.json": json(showcaseBoard()),
    ...starterDesignFiles(),
  };
  for (const [table, rows] of Object.entries(seed))
    files[`data/${table}.json`] = json(rows);
  return files;
}

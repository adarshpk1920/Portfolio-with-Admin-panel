// Demo content inserted on first run only. Everything here is editable from the admin panel.

const settings = {
  site_name: 'Adarsh PK',
  hero_eyebrow: 'Full-stack developer & product designer',
  hero_title: 'I design and build digital products people love to use.',
  hero_subtitle:
    'From first sketch to production deploy, I help startups and teams ship fast, accessible and beautifully crafted web experiences.',
  hero_roles: 'Web Apps, Design Systems, E-commerce, Dashboards, Brand Sites',
  about_title: 'Turning complex problems into simple, elegant interfaces.',
  about_text:
    "I'm a developer and designer with a passion for the space where engineering meets craft. Over the past few years I've partnered with founders, agencies and enterprise teams to plan, design and ship products used by thousands of people every day.\n\nI care about performance, accessibility and the small details: the micro-interaction that makes a button feel right, or the query that turns a 3-second page into a 300 ms one.",
  stat_years: '6',
  stat_clients: '40',
  stat_satisfaction: '98',
  contact_email: 'hello@example.com',
  contact_phone: '+1 (555) 010-2030',
  location: 'Remote · Available worldwide',
  social_github: 'https://github.com/',
  social_linkedin: 'https://www.linkedin.com/',
  social_dribbble: 'https://dribbble.com/',
};

const categories = [
  { name: 'Web Development', slug: 'web-development' },
  { name: 'UI/UX Design', slug: 'ui-ux-design' },
  { name: 'Mobile App', slug: 'mobile-app' },
  { name: 'Branding', slug: 'branding' },
];

const caseStudy = (challenge, approach, outcome) => `## The challenge

${challenge}

## Approach

${approach}

## Outcome

${outcome}`;

const projects = [
  {
    title: 'Lumen Analytics Dashboard',
    slug: 'lumen-analytics-dashboard',
    category: 'web-development',
    summary: 'A real-time SaaS analytics dashboard that turns millions of events into clear, actionable insights.',
    client: 'Lumen Inc.',
    role: 'Lead Full-stack Developer',
    year: '2025',
    tech: 'React, Node.js, PostgreSQL, WebSockets, D3',
    cover_image: '/images/seed/lumen.svg',
    featured: 1,
    content: caseStudy(
      'Lumen\'s customers were exporting CSVs into spreadsheets just to answer basic questions. The existing reporting page took **8+ seconds** to load and offered no real-time view.',
      '- Ran interviews with 12 customers to map the top 5 questions they ask every week\n- Designed a modular widget system so each team can compose its own view\n- Moved aggregation into materialised views and streamed live updates over WebSockets',
      'Median dashboard load dropped from 8.2 s to **0.6 s**, weekly active usage grew **3×**, and CSV exports fell by 70% within two months of launch.'
    ),
    gallery: [
      { path: '/images/seed/lumen-2.svg', caption: 'Widget composer' },
      { path: '/images/seed/lumen-3.svg', caption: 'Live event stream' },
    ],
  },
  {
    title: 'Verde Organic Store',
    slug: 'verde-organic-store',
    category: 'web-development',
    summary: 'A headless e-commerce storefront for an organic grocery brand, built for speed and conversion.',
    client: 'Verde Market',
    role: 'Frontend Developer',
    year: '2025',
    tech: 'Next.js, Stripe, Tailwind CSS, Sanity',
    cover_image: '/images/seed/verde.svg',
    featured: 1,
    content: caseStudy(
      'Verde\'s legacy store had a 78% mobile bounce rate and a seven-step checkout that lost most shoppers before payment.',
      '- Rebuilt the storefront as a statically generated headless site\n- Reduced checkout to two steps with Stripe Payment Element and saved addresses\n- Introduced a subscription box flow with flexible delivery schedules',
      'Mobile conversion rate rose by **42%**, Lighthouse performance reached 98, and subscriptions now drive a third of monthly revenue.'
    ),
    gallery: [{ path: '/images/seed/verde-2.svg', caption: 'Product listing' }],
  },
  {
    title: 'Pulse Fitness App',
    slug: 'pulse-fitness-app',
    category: 'mobile-app',
    summary: 'A cross-platform workout companion with adaptive training plans and social challenges.',
    client: 'Pulse Health',
    role: 'Product Designer & Developer',
    year: '2024',
    tech: 'React Native, Expo, Firebase, HealthKit',
    cover_image: '/images/seed/pulse.svg',
    featured: 1,
    content: caseStudy(
      'Most fitness apps lose 80% of users within a month. Pulse wanted a product that keeps people coming back without relying on guilt-driven notifications.',
      '- Designed adaptive plans that adjust to completed workouts and recovery data\n- Added lightweight friend challenges and streak rewards\n- Built a single React Native codebase that ships to iOS and Android',
      '30-day retention reached **46%** (industry average ≈ 20%) and the app was featured in the App Store "Apps We Love" collection.'
    ),
    gallery: [{ path: '/images/seed/pulse-2.svg', caption: 'Workout flow' }],
  },
  {
    title: 'Nimbus Design System',
    slug: 'nimbus-design-system',
    category: 'ui-ux-design',
    summary: 'A scalable, accessible design system unifying five products under one visual language.',
    client: 'Nimbus Cloud',
    role: 'Design Systems Lead',
    year: '2024',
    tech: 'Figma, Storybook, TypeScript, Web Components',
    cover_image: '/images/seed/nimbus.svg',
    content: caseStudy(
      'Five product teams had built five different button components and inconsistent colour palettes, slowing delivery and confusing users.',
      '- Audited 1,200+ UI instances across products\n- Defined design tokens for colour, type, spacing and motion\n- Shipped 48 accessible components with Storybook docs and usage guidelines',
      'Feature delivery time dropped by **35%**, WCAG AA compliance went from 61% to 100%, and all five products now share one component library.'
    ),
    gallery: [],
  },
  {
    title: 'Atlas Travel Booking',
    slug: 'atlas-travel-booking',
    category: 'ui-ux-design',
    summary: 'A UX overhaul of a travel booking flow, making multi-city trips simple to plan.',
    client: 'Atlas Journeys',
    role: 'UX Designer',
    year: '2023',
    tech: 'Figma, Maze, Hotjar, Vue.js',
    cover_image: '/images/seed/atlas.svg',
    content: caseStudy(
      'Booking a multi-city trip took users an average of 23 minutes and many abandoned halfway through.',
      '- Mapped the journey with session recordings and 20 usability tests\n- Designed a visual itinerary builder with drag-and-drop legs\n- Validated three iterations with unmoderated tests on Maze',
      'Average booking time fell to **9 minutes** and multi-city bookings increased by **58%**.'
    ),
    gallery: [],
  },
  {
    title: 'Ember Coffee Rebrand',
    slug: 'ember-coffee-rebrand',
    category: 'branding',
    summary: 'A warm, modern identity and website for an independent specialty coffee roaster.',
    client: 'Ember Roasters',
    role: 'Brand & Web Designer',
    year: '2023',
    tech: 'Illustrator, Figma, Webflow',
    cover_image: '/images/seed/ember.svg',
    content: caseStudy(
      'Ember had outgrown its hand-drawn logo and wanted an identity that worked equally well on packaging, signage and the web.',
      '- Developed a flexible logo system and a warm, earthy colour palette\n- Designed packaging for 12 single-origin coffees\n- Built a story-driven website with an integrated subscription shop',
      'Online sales doubled in the first quarter after launch and the packaging won a regional design award.'
    ),
    gallery: [],
  },
];

module.exports = { settings, categories, projects };

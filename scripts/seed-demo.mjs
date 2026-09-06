#!/usr/bin/env node
/**
 * ReHome — demo network seeder.
 *
 * Creates fictional demo organizations and donors, then drives them through the
 * real product flow: publish demand, add items, allocate, schedule, hand over,
 * confirm receipt. Everything it produces is a genuine record written by the
 * same RPCs the interface calls, so the organization dashboards and the impact
 * pages show real lifecycle data rather than decorative counters.
 *
 * It uses only the public anon key and the ordinary sign-up endpoint — the same
 * credentials the browser already has. No service-role key is read, required or
 * accepted here, and none should ever be placed in this repository.
 *
 *   node scripts/seed-demo.mjs
 *
 * Safe to run more than once: accounts that already exist are signed in
 * instead, and every insert checks for its own row first.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ── Configuration ─────────────────────────────────────────────────────── */

function readEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match) env[match[1]] = match[2].trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return {
    url: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
  };
}

const { url, anonKey } = readEnv();
if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (checked .env and the environment).");
  process.exit(1);
}

/** Fictional throughout. .test is reserved and cannot receive mail. */
const DEMO_PASSWORD = "Demo@12345";

const ORGANIZATIONS = [
  {
    key: "brightfuture",
    email: "brightfuture.demo@rehome.test",
    name: "Bright Future School",
    orgType: "government_school",
    description:
      "Demo organization. Government school seeking textbooks, notebooks, stationery, school bags and computers for its classrooms.",
    location: "Vellore, Tamil Nadu",
    latitude: 12.9165,
    longitude: 79.1325,
    requirements: [
      { category: "Education", subcategory: "Books", item_type: "Textbook", quantity_requested: 40, required_condition: "Good", urgency: "high" },
      { category: "Education", subcategory: "Stationery", item_type: "Notebook", quantity_requested: 100, required_condition: "Any", urgency: "medium" },
      { category: "Education", subcategory: "Bags", item_type: "School Bag", quantity_requested: 35, required_condition: "Any", urgency: "high" },
      { category: "Electronics", subcategory: "Computers", item_type: "Computer", quantity_requested: 10, required_condition: "Repairable", urgency: "medium" },
    ],
  },
  {
    key: "greencycle",
    email: "greencycle.demo@rehome.test",
    name: "GreenCycle Foundation",
    orgType: "recycler",
    description:
      "Demo organization. Certified recycling and sustainability partner taking e-waste, recyclable electronics, metal and cardboard.",
    location: "Bengaluru, Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
    requirements: [
      { category: "Electronics", subcategory: "E-waste", item_type: "E-waste", quantity_requested: 200, required_condition: "Any", urgency: "medium" },
      { category: "Electronics", subcategory: "Appliances", item_type: "Recyclable Electronics", quantity_requested: 80, required_condition: "Any", urgency: "medium" },
      { category: "Home", subcategory: "Materials", item_type: "Metal", quantity_requested: 150, required_condition: "Any", urgency: "low" },
      { category: "Home", subcategory: "Materials", item_type: "Cardboard", quantity_requested: 300, required_condition: "Any", urgency: "low" },
    ],
  },
  {
    key: "udaan",
    email: "udaan.demo@rehome.test",
    name: "Udaan Community Centre",
    orgType: "community",
    description:
      "Demo organization. Community NGO distributing clothes, books, furniture and toys to families in the neighbourhood.",
    location: "Chennai, Tamil Nadu",
    latitude: 13.0827,
    longitude: 80.2707,
    requirements: [
      { category: "Clothing", subcategory: "Apparel", item_type: "Clothing", quantity_requested: 120, required_condition: "Wearable", urgency: "high" },
      { category: "Education", subcategory: "Books", item_type: "Book", quantity_requested: 60, required_condition: "Any", urgency: "medium" },
      { category: "Furniture", subcategory: "Seating", item_type: "Chair", quantity_requested: 25, required_condition: "Good", urgency: "medium" },
      { category: "Education", subcategory: "Toys", item_type: "Toy", quantity_requested: 70, required_condition: "Any", urgency: "low" },
    ],
  },
  {
    key: "retech",
    email: "retech.demo@rehome.test",
    name: "ReTech Refurbishment Hub",
    orgType: "refurbisher",
    description:
      "Demo organization. Refurbisher restoring laptops, phones, monitors and repairable electronics for reuse.",
    location: "Coimbatore, Tamil Nadu",
    latitude: 11.0168,
    longitude: 76.9558,
    requirements: [
      { category: "Electronics", subcategory: "Computers", item_type: "Laptop", quantity_requested: 30, required_condition: "Repairable", urgency: "high" },
      { category: "Electronics", subcategory: "Phones", item_type: "Mobile Phone", quantity_requested: 45, required_condition: "Repairable", urgency: "medium" },
      { category: "Electronics", subcategory: "Displays", item_type: "Monitor", quantity_requested: 20, required_condition: "Repairable", urgency: "medium" },
    ],
  },
  {
    key: "asha",
    email: "asha.demo@rehome.test",
    name: "Asha Children's Centre",
    orgType: "shelter",
    description:
      "Demo organization. Residential child-care centre needing books, bags, stationery, toys and clothing.",
    location: "Vellore, Tamil Nadu",
    latitude: 12.925,
    longitude: 79.15,
    requirements: [
      { category: "Education", subcategory: "Books", item_type: "Book", quantity_requested: 50, required_condition: "Any", urgency: "high" },
      { category: "Education", subcategory: "Bags", item_type: "School Bag", quantity_requested: 30, required_condition: "Any", urgency: "medium" },
      { category: "Education", subcategory: "Toys", item_type: "Toy", quantity_requested: 40, required_condition: "Any", urgency: "low" },
      { category: "Clothing", subcategory: "Apparel", item_type: "Clothing", quantity_requested: 80, required_condition: "Wearable", urgency: "medium" },
    ],
  },
];

/**
 * Donors, and what each of them contributes. Item types match requirement item
 * types exactly so the matching engine has something real to score; conditions
 * and destinations are left to the engine rather than written by hand.
 */
const DONORS = [
  {
    email: "donor.aarav.demo@rehome.test",
    name: "Aarav (demo donor)",
    location: "Vellore, Tamil Nadu",
    latitude: 12.92,
    longitude: 79.13,
    items: [
      { item_type: "Textbook", category: "Education", subcategory: "Books", condition: "Good", quantity: 6 },
      { item_type: "School Bag", category: "Education", subcategory: "Bags", condition: "Good", quantity: 3 },
      { item_type: "Book", category: "Education", subcategory: "Books", condition: "Fair", quantity: 8 },
    ],
  },
  {
    email: "donor.meera.demo@rehome.test",
    name: "Meera (demo donor)",
    location: "Bengaluru, Karnataka",
    latitude: 12.97,
    longitude: 77.59,
    items: [
      { item_type: "Laptop", category: "Electronics", subcategory: "Computers", condition: "Repairable — minor issue", quantity: 2 },
      { item_type: "E-waste", category: "Electronics", subcategory: "E-waste", condition: "Beyond repair", quantity: 12 },
      { item_type: "Mobile Phone", category: "Electronics", subcategory: "Phones", condition: "Not working", quantity: 4 },
    ],
  },
  {
    email: "donor.rohan.demo@rehome.test",
    name: "Rohan (demo donor)",
    location: "Chennai, Tamil Nadu",
    latitude: 13.08,
    longitude: 80.27,
    items: [
      { item_type: "Clothing", category: "Clothing", subcategory: "Apparel", condition: "Good", quantity: 15 },
      { item_type: "Chair", category: "Furniture", subcategory: "Seating", condition: "Good", quantity: 4 },
      { item_type: "Toy", category: "Education", subcategory: "Toys", condition: "Good", quantity: 9 },
    ],
  },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function client() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Sign up, or sign in when the account is already there. */
async function account(email, password, meta) {
  const supabase = client();
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  });

  if (!signUpError && signUp.session) return { supabase, user: signUp.user, created: true };

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(
      `${email}: ${signInError.message}` +
        (signUpError ? ` (sign-up said: ${signUpError.message})` : "")
    );
  }
  return { supabase, user: signIn.user, created: false };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reuse-first labels, mirroring what the app writes for these conditions. */
function destinationFor(condition, category) {
  const electronics = /electronic/i.test(category);
  if (/beyond repair|not working/i.test(condition)) {
    return { path: electronics ? "Recycling" : "Recycling", reusability: "Materials recovery", score: 28 };
  }
  if (/repairable/i.test(condition)) {
    return { path: "Refurbishment", reusability: "High if repaired", score: 70 };
  }
  return { path: "Direct reuse / donation", reusability: "High", score: 82 };
}

/* ── Seeding ───────────────────────────────────────────────────────────── */

async function seedOrganizations() {
  const result = new Map();

  for (const spec of ORGANIZATIONS) {
    process.stdout.write(`org  ${spec.name} … `);
    const { supabase, user, created } = await account(spec.email, DEMO_PASSWORD, {
      full_name: spec.name,
      account_type: "organization",
    });

    // The signup trigger has already made an organization for this account, or
    // the demo migration has handed it a seeded one.
    const { data: org, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error || !org) throw new Error(`${spec.name}: no organization row (${error?.message ?? "none found"})`);

    await supabase
      .from("organizations")
      .update({
        name: spec.name,
        org_type: spec.orgType,
        description: spec.description,
        location: spec.location,
        latitude: spec.latitude,
        longitude: spec.longitude,
        contact_email: spec.email,
      })
      .eq("id", org.id);

    const { data: existing } = await supabase
      .from("requirements")
      .select("item_type")
      .eq("organization_id", org.id);
    const have = new Set((existing ?? []).map((r) => r.item_type));

    const missing = spec.requirements.filter((r) => !have.has(r.item_type));
    if (missing.length > 0) {
      const { error: reqError } = await supabase.from("requirements").insert(
        missing.map((r) => ({
          organization_id: org.id,
          category: r.category,
          subcategory: r.subcategory,
          item_type: r.item_type,
          quantity_requested: r.quantity_requested,
          required_condition: r.required_condition,
          location: spec.location,
          latitude: spec.latitude,
          longitude: spec.longitude,
          urgency: r.urgency,
          status: "open",
        }))
      );
      if (reqError) throw new Error(`${spec.name} requirements: ${reqError.message}`);
    }

    result.set(spec.key, { spec, supabase, org, userId: user.id });
    console.log(
      `${created ? "created" : "existing"}, ${spec.requirements.length} requirements, verification=${org.verification_status}`
    );
    await sleep(400);
  }

  return result;
}

async function seedDonor(donor, orgs) {
  process.stdout.write(`donor ${donor.name} … `);
  const { supabase, user, created } = await account(donor.email, DEMO_PASSWORD, {
    full_name: donor.name,
    account_type: "individual",
  });

  await supabase
    .from("profiles")
    .update({
      location: donor.location,
      latitude: donor.latitude,
      longitude: donor.longitude,
      location_precision: "area",
    })
    .eq("user_id", user.id);

  // Every open requirement this donor can actually see, so allocations target
  // demand that genuinely exists rather than a hard-coded id.
  //
  // Restricted to the demo organizations on purpose. The directory rows seeded
  // by the first migration have no owner, so nobody can ever confirm receipt
  // against them — an allocation sent there would sit at "handed over" for
  // good, which is exactly what happened the first time this ran.
  const demoOrgIds = new Set([...orgs.values()].map((o) => o.org.id));
  const { data: allRequirements } = await supabase
    .from("requirements")
    .select("*")
    .in("status", ["open", "partially_fulfilled"]);
  const requirements = (allRequirements ?? []).filter((r) => demoOrgIds.has(r.organization_id));

  let confirmed = 0;

  for (const spec of donor.items) {
    const { data: existingItem } = await supabase
      .from("items")
      .select("*")
      .eq("owner_id", user.id)
      .eq("item_type", spec.item_type)
      .maybeSingle();

    if (existingItem?.status === "second_life_confirmed") continue;

    // Release anything parked against an organization that cannot confirm, so
    // a re-run can route the item somewhere a receipt is actually possible.
    if (existingItem) {
      const { data: stuck } = await supabase
        .from("match_allocations")
        .select("id, status, organization_id")
        .eq("item_id", existingItem.id)
        .not("status", "in", "(confirmed,cancelled)");
      for (const row of stuck ?? []) {
        if (!demoOrgIds.has(row.organization_id)) {
          await supabase.rpc("cancel_allocation", { p_allocation_id: row.id });
        }
      }
    }

    const destination = destinationFor(spec.condition, spec.category);
    const { data: item, error: itemError } = existingItem
      ? { data: existingItem, error: null }
      : await supabase
      .from("items")
      .insert({
        owner_id: user.id,
        category: spec.category,
        subcategory: spec.subcategory,
        item_type: spec.item_type,
        condition: spec.condition,
        reusability: destination.reusability,
        reusability_score: destination.score,
        destination_path: destination.path,
        potential_use: "Demo seed",
        location: donor.location,
        latitude: donor.latitude,
        longitude: donor.longitude,
        quantity: spec.quantity,
        ai_source: "manual",
        user_corrected: true,
        notes: "Seeded demo contribution",
        status: "listed",
      })
      .select("*")
      .single();
    if (itemError) throw new Error(`${donor.name} / ${spec.item_type}: ${itemError.message}`);

    const target = requirements.find(
      (r) => r.item_type === spec.item_type && r.quantity_remaining > 0
    );
    if (!target) {
      console.warn(`\n  no demo requirement open for ${spec.item_type}`);
      continue;
    }

    // Contribute part of the item, never the whole requirement: a donation is
    // one contribution among many, and the seed should look like that.
    const quantity = Math.max(1, Math.min(spec.quantity, target.quantity_remaining));

    const { data: allocation, error: allocError } = await supabase.rpc("allocate_to_requirement", {
      p_item_id: item.id,
      p_requirement_id: target.id,
      p_quantity: quantity,
      p_match_id: null,
    });
    if (allocError) throw new Error(`${donor.name} allocate: ${allocError.message}`);
    const alloc = Array.isArray(allocation) ? allocation[0] : allocation;

    const when = new Date(Date.now() + 86_400_000).toISOString();
    await supabase.rpc("schedule_handoff", {
      p_allocation_id: alloc.id,
      p_scheduled_for: when,
      p_location: "Reception desk",
      p_notes: null,
    });
    await supabase.rpc("mark_handed_over", { p_allocation_id: alloc.id });

    // The receiving organization is the only party that can confirm, which is
    // exactly why the seed switches sessions here instead of forcing it.
    const receiver = [...orgs.values()].find((o) => o.org.id === alloc.organization_id);
    if (!receiver) {
      // Nothing here can confirm, so do not leave the units reserved.
      await supabase.rpc("cancel_allocation", { p_allocation_id: alloc.id });
      console.warn(`\n  no confirming owner for ${spec.item_type}; allocation released`);
      continue;
    }

    const { error: confirmError } = await receiver.supabase.rpc("confirm_second_life", {
      p_allocation_id: alloc.id,
    });
    if (confirmError) throw new Error(`${donor.name} confirm: ${confirmError.message}`);
    confirmed += 1;
  }

  console.log(`${created ? "created" : "existing"}, ${confirmed} confirmed handoffs`);
  await sleep(400);
}

async function main() {
  console.log(`ReHome demo seed → ${url}\n`);
  const orgs = await seedOrganizations();
  console.log("");
  for (const donor of DONORS) {
    await seedDonor(donor, orgs);
  }

  console.log("\nDemo credentials (all fictional, password below):");
  console.log(`  password: ${DEMO_PASSWORD}`);
  for (const spec of ORGANIZATIONS) console.log(`  org   ${spec.email}  ${spec.name}`);
  for (const donor of DONORS) console.log(`  donor ${donor.email}  ${donor.name}`);
  console.log("\nDone.");
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message);
  process.exit(1);
});

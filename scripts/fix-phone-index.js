/**
 * Migration (Phase 1): Drop unique phone_1 index and clean legacy phone null/empty values.
 *
 * Business rules:
 * - Phone must NOT be unique across users.
 * - Signup/login must not depend on phone.
 * - App must continue working as before (phone OTP still stored on User for now).
 *
 * What this script does:
 *  1) Unsets phone for any user documents where phone is explicitly null.
 *  2) Unsets phone for any user documents where phone is an empty string.
 *  3) Drops the existing phone_1 index if it exists.
 *  4) DOES NOT recreate any phone index (especially not unique).
 *
 * Run once after deploying schema change:
 *   node scripts/fix-phone-index.js
 */

"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not set.");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const collection = db.collection("users");

  // Step 1: Unset phone where it is explicitly null (do NOT delete users).
  const unsetNullResult = await collection.updateMany(
    { phone: null },
    { $unset: { phone: "" } }
  );
  console.log(
    `Unset phone on ${unsetNullResult.modifiedCount} user(s) with phone: null.`
  );

  // Step 2: Unset phone where it is an empty string.
  const unsetEmptyResult = await collection.updateMany(
    { phone: "" },
    { $unset: { phone: "" } }
  );
  console.log(
    `Unset phone on ${unsetEmptyResult.modifiedCount} user(s) with empty phone.`
  );

  // Step 3: Drop the existing phone_1 index (may be unique/non-sparse).
  const indexes = await collection.indexes();
  const phoneIndex = indexes.find((idx) => idx.name === "phone_1");

  if (phoneIndex) {
    await collection.dropIndex("phone_1");
    console.log("Dropped phone_1 index.");
  } else {
    console.log("phone_1 index not found — skipping drop.");
  }

  // Step 4: IMPORTANT — do not recreate any index on phone here.
  await mongoose.disconnect();
  console.log("Done. Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
